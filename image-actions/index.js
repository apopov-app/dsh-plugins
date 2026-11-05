/**
 * Host half of the image-actions bundle.
 *
 * The browser can copy a picture to the clipboard itself, but it cannot write
 * a file into Downloads or reveal a file in Finder/Explorer. This half owns
 * those operations: it accepts image bytes (or a local path, or a remote URL),
 * writes them under a readable name into `~/Downloads/DSH Images`, and opens
 * the platform's file manager on a saved or original file.
 *
 * Every request is authenticated by the Connection, the bytes must sniff as a
 * known image, and every written name is derived from a sanitized stem plus a
 * sniffed extension, so this route cannot be pointed at an arbitrary file name.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

/** Authenticated Connection route the browser half posts to. */
const ROUTE_PATH = '/api/image-actions';
/** Largest image accepted from the browser or a remote address. */
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
/** Request body bound: base64 grows an image by a third, plus a little JSON slack. */
const MAX_REQUEST_BYTES = Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 1024 * 1024;
/** Deadline for one remote image download. */
const FETCH_TIMEOUT_MS = 20_000;
/** Deadline for one reveal command. */
const COMMAND_TIMEOUT_MS = 8_000;
/** Longest file name stem accepted from the browser. */
const MAX_STEM_CHARS = 100;
/** Collision suffixes tried before a write gives up. */
const MAX_NAME_ATTEMPTS = 999;
/** Longest path accepted by reveal and local-path save. */
const MAX_PATH_CHARS = 4096;
/** Folder under Downloads that keeps saved pictures together. */
const DOWNLOAD_FOLDER = 'DSH Images';

/** A request-level failure with a stable code and HTTP status. */
class ImageActionError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'ImageActionError';
    this.code = code;
    this.status = status;
  }
}

/** Narrow an unknown thrown value to a readable message. */
function messageOf(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.length === 0 ? 'unknown failure' : message;
}

/** Build one JSON error response. */
function jsonError(status, message, code) {
  return Response.json({ message, code }, { status });
}

/** The folder saved pictures land in; `DSH_IMAGE_ACTIONS_DIR` overrides it. */
function downloadsDir() {
  const override = process.env.DSH_IMAGE_ACTIONS_DIR;
  if (typeof override === 'string' && override.trim() !== '') return path.resolve(override.trim());
  return path.join(os.homedir(), 'Downloads', DOWNLOAD_FOLDER);
}

/** Decode a bounded base64 image body. */
function decodeBase64(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ImageActionError('the image data is missing', 'BAD_DATA', 400);
  }
  if (value.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 8) {
    throw new ImageActionError('the image is too large', 'TOO_LARGE', 413);
  }
  const compact = value.replace(/\s+/g, '');
  if (compact.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) {
    throw new ImageActionError('the image data is not valid base64', 'BAD_DATA', 400);
  }
  const bytes = Buffer.from(compact, 'base64');
  if (bytes.byteLength === 0) throw new ImageActionError('the image data is empty', 'BAD_DATA', 400);
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageActionError('the image is too large', 'TOO_LARGE', 413);
  }
  return bytes;
}

/** Latin-1 text of a byte range, for fixed byte signatures. */
function ascii(bytes, offset, length) {
  return bytes.subarray(offset, offset + length).toString('latin1');
}

/**
 * Identify an image from its first bytes. A file is saved only when its
 * content is a known image format, whatever extension the caller suggested.
 * @param bytes - the complete file bytes.
 * @returns the MIME type and extension, or null for anything else.
 */
function sniffImage(bytes) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG'
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (bytes.length >= 6 && (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a')) {
    return { mime: 'image/gif', ext: 'gif' };
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  if (bytes.length >= 2 && ascii(bytes, 0, 2) === 'BM') {
    return { mime: 'image/bmp', ext: 'bmp' };
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4);
    if (brand === 'avif' || brand === 'avis') return { mime: 'image/avif', ext: 'avif' };
  }
  const head = new TextDecoder().decode(bytes.subarray(0, 8192)).replace(/^\uFEFF/, '');
  const probe = head
    .replace(/^<\?xml[\s\S]*?\?>/i, '')
    .replace(/^(?:<!--[\s\S]*?-->\s*)+/, '')
    .trimStart();
  if (/^<svg[\s>]/i.test(probe)) return { mime: 'image/svg+xml', ext: 'svg' };
  return null;
}

/** A readable default stem for an image without a usable name. */
function timestampStem() {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return `image ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} `
    + `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

/**
 * One file-name stem, safe on every supported platform: no separators, no
 * control or reserved characters, no trailing dot, no Windows device name.
 * @param hint - the caller's suggested name, possibly with an extension.
 * @returns a non-empty stem.
 */
function safeStem(hint) {
  const raw = typeof hint === 'string' ? hint : '';
  const name = raw.replace(/\\/g, '/').split('/').pop() ?? '';
  let stem = name
    .replace(/\.(png|jpe?g|gif|webp|avif|bmp|svg|heic|heif|tiff?)$/i, '')
    .replace(/[\u0000-\u001f\u007f<>:"|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .trim();
  if (stem === '' || /^image$/i.test(stem)) stem = timestampStem();
  if (stem.length > MAX_STEM_CHARS) stem = stem.slice(0, MAX_STEM_CHARS).trim();
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem)) stem = `_${stem}`;
  return stem;
}

/**
 * Write one file under a fresh name in a directory.
 * @returns the absolute written path and its basename.
 */
async function writeUnique(directory, stem, extension, bytes) {
  try {
    await fs.mkdir(directory, { recursive: true });
  } catch (error) {
    throw new ImageActionError(`cannot create ${directory}: ${messageOf(error)}`, 'WRITE_FAILED', 500);
  }
  for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt += 1) {
    const name = `${stem}${attempt === 1 ? '' : ` (${attempt})`}.${extension}`;
    const target = path.join(directory, name);
    try {
      await fs.writeFile(target, bytes, { flag: 'wx', mode: 0o644 });
      return { path: target, name };
    } catch (error) {
      if (error?.code === 'EEXIST') continue;
      throw new ImageActionError(`cannot write ${name}: ${messageOf(error)}`, 'WRITE_FAILED', 500);
    }
  }
  throw new ImageActionError('too many files already use this name', 'WRITE_FAILED', 500);
}

/**
 * Save one image under a readable name.
 * @param bytes - complete image bytes.
 * @param hint - the caller's suggested name.
 * @returns the saved path, basename, directory, and detected MIME type.
 */
async function saveImageBytes(bytes, hint) {
  if (bytes.byteLength === 0) throw new ImageActionError('the image is empty', 'BAD_DATA', 400);
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageActionError('the image is too large', 'TOO_LARGE', 413);
  }
  const image = sniffImage(bytes);
  if (image === null) {
    throw new ImageActionError('the bytes are not a supported image', 'UNSUPPORTED_IMAGE', 415);
  }
  const directory = downloadsDir();
  const written = await writeUnique(directory, safeStem(hint), image.ext, bytes);
  return { path: written.path, name: written.name, directory, mime: image.mime };
}

/** Accept only an absolute, control-free path. */
function requireAbsolutePath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_PATH_CHARS) {
    throw new ImageActionError('a file path is required', 'BAD_REQUEST', 400);
  }
  if (/[\u0000-\u001f\u007f]/.test(value) || !path.isAbsolute(value)) {
    throw new ImageActionError('the file path must be absolute', 'BAD_REQUEST', 400);
  }
  return path.resolve(value);
}

/** Read one local image with a size bound, refusing non-image content. */
async function readLocalImage(value) {
  const target = requireAbsolutePath(value);
  let info;
  try {
    info = await fs.stat(target);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new ImageActionError('the image file no longer exists', 'NOT_FOUND', 404);
    }
    throw new ImageActionError(`cannot read the image file: ${messageOf(error)}`, 'BAD_REQUEST', 400);
  }
  if (!info.isFile()) throw new ImageActionError('the path is not a regular file', 'NOT_FILE', 400);
  if (info.size > MAX_IMAGE_BYTES) {
    throw new ImageActionError('the image is too large', 'TOO_LARGE', 413);
  }
  const bytes = await fs.readFile(target);
  const image = sniffImage(bytes);
  if (image === null) {
    throw new ImageActionError('the file is not a supported image', 'UNSUPPORTED_IMAGE', 415);
  }
  return bytes;
}

/** Read a response body under a hard byte cap. */
async function readBoundedBody(response, limit) {
  const body = response.body;
  if (body === null) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => {
          // The failure below is the actionable one; a cancel failure changes nothing.
        });
        throw new ImageActionError('the image is too large', 'TOO_LARGE', 413);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

/** Decode a `data:` image URL. */
function decodeDataUrl(src) {
  const match = /^data:([^;,]*)(;[^,]*)?,([\s\S]*)$/.exec(src);
  if (match === null) throw new ImageActionError('the data URL is malformed', 'BAD_DATA', 400);
  const payload = match[3] ?? '';
  const bytes = /;base64/i.test(match[2] ?? '')
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageActionError('the image is too large', 'TOO_LARGE', 413);
  }
  return bytes;
}

/**
 * Fetch one remote image (or decode one data URL) with a total byte cap.
 * @param src - the browser-side URL.
 * @returns the complete image bytes.
 */
async function fetchRemoteImage(src) {
  if (typeof src !== 'string' || src.length === 0) {
    throw new ImageActionError('an image address is required', 'BAD_REQUEST', 400);
  }
  let url;
  try {
    url = new URL(src);
  } catch {
    throw new ImageActionError('the image address is not a URL', 'BAD_REQUEST', 400);
  }
  if (url.protocol === 'data:') return decodeDataUrl(src);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ImageActionError('the image address must be HTTP or HTTPS', 'UNSUPPORTED_SOURCE', 400);
  }
  let response;
  try {
    response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: 'image/*' },
    });
  } catch (error) {
    throw new ImageActionError(`cannot download the image: ${messageOf(error)}`, 'FETCH_FAILED', 502);
  }
  if (!response.ok) {
    throw new ImageActionError(
      `the image address answered HTTP ${response.status}`,
      'FETCH_FAILED',
      502,
    );
  }
  const declared = Number(response.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
    throw new ImageActionError('the image is too large', 'TOO_LARGE', 413);
  }
  return readBoundedBody(response, MAX_IMAGE_BYTES);
}

/** The platform command that reveals one file in the file manager. */
function revealCommand(target) {
  if (process.platform === 'darwin') return { command: 'open', args: ['-R', target] };
  if (process.platform === 'win32') return { command: 'explorer.exe', args: [`/select,${target}`] };
  return { command: 'xdg-open', args: [path.dirname(target)] };
}

/** Run one native command with a bounded wait. */
function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error === null) resolve();
      else reject(error);
    };
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      if (stderr.length < 8000) stderr += String(chunk);
    });
    child.once('error', (error) => {
      finish(new ImageActionError(`cannot run ${command}: ${messageOf(error)}`, 'COMMAND_FAILED', 500));
    });
    child.once('close', (code) => {
      // explorer.exe reports 1 even when the window opened; the other
      // platforms report a real failure and keep their message.
      if (code === 0 || process.platform === 'win32') {
        finish(null);
        return;
      }
      finish(new ImageActionError(
        `${command} failed with exit code ${code}${stderr.trim() === '' ? '' : `: ${stderr.trim()}`}`,
        'COMMAND_FAILED',
        500,
      ));
    });
    timer = setTimeout(() => {
      child.kill();
      finish(new ImageActionError(`${command} did not finish in time`, 'COMMAND_TIMEOUT', 500));
    }, COMMAND_TIMEOUT_MS);
  });
}

/** Reveal one saved or original file. */
async function revealFile(value) {
  const target = requireAbsolutePath(value);
  let info;
  try {
    info = await fs.stat(target);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new ImageActionError('the image file no longer exists', 'NOT_FOUND', 404);
    }
    throw new ImageActionError(`cannot read the file: ${messageOf(error)}`, 'BAD_REQUEST', 400);
  }
  if (!info.isFile()) throw new ImageActionError('the path is not a regular file', 'NOT_FILE', 400);
  const { command, args } = revealCommand(target);
  await runCommand(command, args);
  return { path: target };
}

/**
 * Serve one image action.
 * @param ctx - Host context, used only for logging.
 * @param request - the buffered Connection request.
 * @returns the JSON response.
 */
async function routeRequest(ctx, request) {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
    return jsonError(413, 'the request body is too large', 'TOO_LARGE');
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'request body must be JSON', 'BAD_REQUEST');
  }
  if (body === null || typeof body !== 'object' || typeof body.action !== 'string') {
    return jsonError(400, 'an action is required', 'BAD_REQUEST');
  }
  try {
    switch (body.action) {
      case 'save':
        return Response.json(await saveImageBytes(decodeBase64(body.data), body.name));
      case 'save-path':
        return Response.json(await saveImageBytes(await readLocalImage(body.path), body.name));
      case 'save-src':
        return Response.json(await saveImageBytes(await fetchRemoteImage(body.src), body.name));
      case 'read': {
        const bytes = await fetchRemoteImage(body.src);
        const image = sniffImage(bytes);
        if (image === null) {
          throw new ImageActionError('the bytes are not a supported image', 'UNSUPPORTED_IMAGE', 415);
        }
        return Response.json({ mime: image.mime, data: bytes.toString('base64') });
      }
      case 'reveal':
        return Response.json(await revealFile(body.path));
      default:
        return jsonError(400, 'unknown action', 'BAD_REQUEST');
    }
  } catch (error) {
    if (error instanceof ImageActionError) {
      return Response.json({ message: error.message, code: error.code }, { status: error.status });
    }
    ctx.logger?.warn?.(`image-actions: ${messageOf(error)}`);
    return Response.json({ message: messageOf(error), code: 'INTERNAL' }, { status: 500 });
  }
}

/** Register the image-action route for the lifetime of this plugin. */
export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: ROUTE_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: (request) => routeRequest(ctx, request),
      }),
    'image-actions: image route',
  );
}

/** Connection carries the route; no other service is required. */
export const inject = ['connection'];
