/**
 * Host half of the hard-delete bundle.
 *
 * The shipped Session menu can archive a dialog but never erase it: the JSONL
 * log, its projection checkpoint, its Workspace accounting, and its archive /
 * pin membership all survive. This half owns the operations a browser cannot
 * perform: it stops the dialog's running work, detaches it from the Workspace
 * registry, deletes its log directory and cached projections, and tells every
 * connected client that the row is gone.
 *
 * Deletion is not reversible. The route only answers the authenticated
 * Connection, and every action names one existing session id.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** Authenticated Connection route the browser half posts to. */
const ROUTE_PATH = '/api/delete-session';
/** Longest Session id accepted from the browser. */
const MAX_SESSION_ID_CHARS = 200;
/** Hard cap on a cascade through subagent descendants. */
const MAX_DESCENDANTS = 1000;
/** How long to wait for a stopped turn to leave `running` before deleting its log. */
const IDLE_WAIT_MS = 3000;
/** Polling interval for the idle wait. */
const IDLE_POLL_MS = 100;
/** Delay before the one startup orphan-cache sweep, so boot writes settle first. */
const ORPHAN_SWEEP_DELAY_MS = 1500;
/** Record keys are path segments in the projection cache's per-record layout. */
const SAFE_CACHE_KEY = /^[A-Za-z0-9_-]+$/;

/** One request-level failure with a stable code and HTTP status. */
class DeleteSessionError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'DeleteSessionError';
    this.code = code;
    this.status = status;
  }
}

/** Narrow an unknown thrown value to a readable message. */
function messageOf(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.length === 0 ? 'unknown failure' : message;
}

/** The DSH home that owns durable state for this installation. */
function hostHome() {
  const configured = process.env.DSH_HOME;
  if (typeof configured === 'string' && configured.length > 0) return configured;
  return path.join(os.homedir(), '.dsh');
}

/**
 * Encode one path segment exactly as the JSONL session backend does, so the
 * id maps onto its on-disk directory regardless of unusual characters.
 * @param raw - the segment to encode.
 * @returns the filesystem-safe segment.
 */
function encodeSegment(raw) {
  if (raw.length === 0) throw new Error('cannot encode an empty path segment');
  if (raw === '.') return '~002E';
  if (raw === '..') return '~002E~002E';
  let out = '';
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    const ch = String.fromCharCode(code);
    if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) {
      out += ch;
    } else {
      out += '~' + code.toString(16).toUpperCase().padStart(4, '0');
    }
  }
  return out;
}

/** Root directory of the JSONL session logs. */
function sessionsRoot(ctx) {
  const persistence = ctx.get('sessionPersistence');
  const configured = persistence?.root;
  if (typeof configured === 'string' && path.isAbsolute(configured)) return configured;
  return path.join(hostHome(), 'sessions');
}

/** Directory of the per-session projection checkpoints. */
function projectionCacheRoot() {
  return path.join(hostHome(), 'storages', 'session_projcache', 'sessions');
}

/**
 * Every stored directory belonging to one Session. The layout is
 * `<root>/<project>/<encoded-id>`, and an id is unique across projects; a
 * scan tolerates a project directory whose name no longer follows any cwd
 * rule.
 * @param ctx - Host context (reads the backend root when it exposes one).
 * @param sessionId - the Session whose directory to resolve.
 * @returns absolute session directories that exist.
 */
async function listSessionDirs(ctx, sessionId) {
  const segment = encodeSegment(sessionId);
  const root = sessionsRoot(ctx);
  const dirs = [];
  let projects;
  try {
    projects = await fs.readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return dirs;
    throw error;
  }
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const candidate = path.join(root, project.name, segment);
    try {
      if ((await fs.stat(candidate)).isDirectory()) dirs.push(candidate);
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
    }
  }
  return dirs;
}

/**
 * Remove one Session's projection checkpoint and its invalid-record backups.
 * The cache is disposable derived data, but "hard delete" also erases what it
 * recorded about the conversation.
 * @param sessionId - the Session whose cached row to erase.
 */
async function removeProjectionCheckpoint(sessionId) {
  if (!SAFE_CACHE_KEY.test(sessionId)) return;
  const root = projectionCacheRoot();
  const document = path.join(root, `${sessionId}.json`);
  await fs.rm(document, { force: true });
  let entries;
  try {
    entries = await fs.readdir(root);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  for (const name of entries) {
    if (name.startsWith(`${sessionId}.json.bak.`)) {
      await fs.rm(path.join(root, name), { force: true });
    }
  }
}

/**
 * Erase one Session's cached projections. The cache service owns its table
 * but exposes no deletion method; the table is a `KvTable`, so a reachable
 * one is the authoritative erase (memory and medium together). The documented
 * per-record document is the fallback when the internals are unavailable.
 * @param ctx - Host context.
 * @param sessionId - the Session whose cache row to erase.
 * @param warnings - collector for non-fatal failures.
 */
async function eraseProjectionCheckpoint(ctx, sessionId, warnings) {
  const cache = ctx.get('sessionProjectionCache');
  const table = cache?.table;
  if (table !== undefined && typeof table.delete === 'function') {
    try {
      await table.delete(sessionId);
      return;
    } catch (error) {
      warnings.push(`cannot erase the cached projections through the cache service for ${sessionId}: ${messageOf(error)}`);
    }
  }
  await removeProjectionCheckpoint(sessionId);
}

/** Project one activity family into the JSON the dialog renders. */
function serializeActivity(entry) {
  if (entry === null || typeof entry !== 'object') return { kind: 'unknown' };
  const items = Array.isArray(entry.items)
    ? entry.items.map(item => ({
      id: String(item?.id ?? ''),
      ...(typeof item?.label === 'string' ? { label: item.label } : {}),
    }))
    : undefined;
  return {
    kind: String(entry.kind ?? 'unknown'),
    ...(items === undefined ? {} : { items }),
  };
}

/**
 * Headers visible to this Host: every stored Session plus every live one.
 * @param ctx - Host context.
 * @returns a map keyed by Session id.
 */
async function readHeaders(ctx) {
  const headers = new Map();
  const persistence = ctx.get('sessionPersistence');
  if (persistence !== undefined) {
    for (const snapshot of await persistence.list()) headers.set(snapshot.header.id, snapshot.header);
  }
  const sessions = ctx.get('sessions');
  if (sessions !== undefined) {
    for (const session of sessions.list()) headers.set(session.id, session.header);
  }
  return headers;
}

/**
 * Subagent children of one Session, recursively. Forks carry a parent header
 * too, but they are independent dialogs, so only `origin: 'subagent'` edges
 * cascade.
 * @param headers - all known headers.
 * @param rootId - the dialog being deleted.
 * @returns descendant Session ids in breadth-first order.
 */
function descendantIds(headers, rootId) {
  const children = new Map();
  for (const header of headers.values()) {
    if (header.origin !== 'subagent' || header.parentSession === undefined) continue;
    const list = children.get(header.parentSession);
    if (list === undefined) children.set(header.parentSession, [header.id]);
    else list.push(header.id);
  }
  const found = [];
  const seen = new Set([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const parent = queue.shift();
    for (const child of children.get(parent) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      found.push(child);
      if (found.length > MAX_DESCENDANTS) {
        throw new DeleteSessionError(
          `this dialog owns more than ${MAX_DESCENDANTS} subagent dialogs; delete them individually`,
          'TOO_MANY_DESCENDANTS',
          409,
        );
      }
      queue.push(child);
    }
  }
  return found;
}

/**
 * Ask every provider to stop the Session's work and wait (bounded) until its
 * agent leaves `running`. A failing provider aborts the deletion: erasing a
 * log that a turn still writes to would leave the app with unlinked files.
 * @param ctx - Host context.
 * @param ids - Sessions to stop.
 */
async function stopWork(ctx, ids) {
  for (const sessionId of ids) {
    try {
      await ctx.parallel('workspace/session-stop', { sessionId });
    } catch (error) {
      throw new DeleteSessionError(
        `cannot stop the running work: ${messageOf(error)}`,
        'STOP_FAILED',
        409,
      );
    }
  }
  const agents = ctx.get('agents');
  if (agents === undefined) return;
  const deadline = Date.now() + IDLE_WAIT_MS;
  while (Date.now() < deadline) {
    const running = ids.some((id) => {
      const agent = agents.get(id);
      return agent !== undefined && agent.status === 'running';
    });
    if (!running) return;
    await new Promise(resolve => setTimeout(resolve, IDLE_POLL_MS));
  }
}

/**
 * Detach the Sessions from the Workspace registry and drop their archive and
 * pin memberships. Failures are warnings: the log deletion is the requested
 * outcome and does not depend on the registry write succeeding.
 * @param ctx - Host context.
 * @param ids - Sessions being erased.
 * @param warnings - collector for non-fatal failures.
 */
async function forgetRegistrySessions(ctx, ids, warnings) {
  const registry = ctx.get('workspaceRegistry');
  if (registry === undefined) return;
  for (const sessionId of ids) {
    try {
      await registry.unarchiveSession(sessionId);
    } catch (error) {
      warnings.push(`cannot drop archive membership for ${sessionId}: ${messageOf(error)}`);
    }
    try {
      await registry.unpinSession(sessionId);
    } catch (error) {
      warnings.push(`cannot drop pin membership for ${sessionId}: ${messageOf(error)}`);
    }
  }
  let workspaces;
  try {
    workspaces = registry.list();
  } catch (error) {
    warnings.push(`cannot list workspaces: ${messageOf(error)}`);
    return;
  }
  for (const workspace of workspaces) {
    for (const sessionId of ids) {
      try {
        await workspace.detachSession(sessionId);
      } catch (error) {
        warnings.push(`cannot detach ${sessionId} from workspace ${workspace.id}: ${messageOf(error)}`);
      }
    }
  }
}

/**
 * Inspect one dialog: whether it exists, whether it is live, its registry
 * membership, what currently runs for it, and how many subagent logs would
 * cascade.
 * @param ctx - Host context.
 * @param sessionId - the dialog to inspect.
 * @returns the confirmation payload.
 */
async function inspectSession(ctx, sessionId) {
  const persistence = ctx.get('sessionPersistence');
  const sessions = ctx.get('sessions');
  const live = sessions?.get(sessionId);
  let stored;
  let storedError;
  if (persistence !== undefined) {
    try {
      stored = await persistence.stat(sessionId);
    } catch (error) {
      storedError = error;
    }
  }
  const dirs = await listSessionDirs(ctx, sessionId);
  if (live === undefined && stored === undefined && dirs.length === 0) {
    if (storedError !== undefined) {
      throw new DeleteSessionError(`cannot read the dialog storage: ${messageOf(storedError)}`, 'STORAGE_FAILED', 500);
    }
    throw new DeleteSessionError('this dialog is no longer stored', 'SESSION_NOT_FOUND', 404);
  }
  let headers = new Map();
  try {
    headers = await readHeaders(ctx);
  } catch (error) {
    ctx.logger?.warn?.(`delete-session: header listing failed for ${sessionId}: ${messageOf(error)}`);
  }
  const descendants = descendantIds(headers, sessionId);
  const registry = ctx.get('workspaceRegistry');
  let activity = [];
  try {
    activity = await ctx.waterfall(
      'workspace/session-activity',
      { sessionId },
      () => Promise.resolve([]),
    );
  } catch (error) {
    // The probe is advisory; the deletion itself re-runs the stop path.
    ctx.logger?.warn?.(`delete-session: activity probe failed for ${sessionId}: ${messageOf(error)}`);
  }
  return {
    sessionId,
    exists: true,
    live: live !== undefined,
    archived: registry?.archivedSessionIds.includes(sessionId) ?? false,
    pinned: registry?.pinnedSessionIds.includes(sessionId) ?? false,
    activity: activity.map(serializeActivity),
    descendants: descendants.length,
  };
}

/**
 * Permanently erase one dialog and its subagent descendants: stop work,
 * forget registry state, remove every session directory and cached
 * projection, then tell clients the rows are gone.
 * @param ctx - Host context.
 * @param sessionId - the dialog to erase.
 * @returns the erased ids and non-fatal warnings.
 */
async function purgeSession(ctx, sessionId) {
  const persistence = ctx.get('sessionPersistence');
  const sessions = ctx.get('sessions');
  const live = sessions?.get(sessionId);
  let stored;
  let storedError;
  if (persistence !== undefined) {
    try {
      stored = await persistence.stat(sessionId);
    } catch (error) {
      storedError = error;
    }
  }
  const dirs = await listSessionDirs(ctx, sessionId);
  if (live === undefined && stored === undefined && dirs.length === 0) {
    if (storedError !== undefined) {
      throw new DeleteSessionError(`cannot read the dialog storage: ${messageOf(storedError)}`, 'STORAGE_FAILED', 500);
    }
    throw new DeleteSessionError('this dialog is no longer stored', 'SESSION_NOT_FOUND', 404);
  }

  const warnings = [];
  let headers = new Map();
  try {
    headers = await readHeaders(ctx);
  } catch (error) {
    warnings.push(`cannot list stored sessions: ${messageOf(error)}`);
  }
  const targets = [sessionId, ...descendantIds(headers, sessionId)];

  await stopWork(ctx, targets);

  await forgetRegistrySessions(ctx, targets, warnings);

  const deleted = [];
  for (const id of targets) {
    for (const dir of await listSessionDirs(ctx, id)) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch (error) {
        throw new DeleteSessionError(
          `cannot erase the dialog directory ${JSON.stringify(dir)}: ${messageOf(error)}`,
          'DELETE_FAILED',
          500,
        );
      }
    }
    try {
      await eraseProjectionCheckpoint(ctx, id, warnings);
    } catch (error) {
      warnings.push(`cannot erase the cached projections for ${id}: ${messageOf(error)}`);
    }
    deleted.push(id);
  }

  for (const id of deleted) {
    try {
      ctx.emit('api-session/removed', id);
    } catch (error) {
      warnings.push(`cannot notify clients about ${id}: ${messageOf(error)}`);
    }
  }
  for (const warning of warnings) {
    ctx.logger?.warn?.(`delete-session: ${warning}`);
  }
  return { deleted, warnings };
}

/**
 * Remove cached projection rows whose Session no longer exists. A dialog
 * deleted while live can receive one final checkpoint during Host shutdown;
 * the next startup erases that orphan, so no cached title or message text
 * outlives the dialog. Runs once, only after both services are ready, and
 * skips the sweep when the persistence listing fails.
 * @param ctx - Host context carrying both services.
 */
async function sweepOrphanProjectionRows(ctx) {
  const persistence = ctx.get('sessionPersistence');
  const cache = ctx.get('sessionProjectionCache');
  const table = cache?.table;
  if (persistence === undefined || table === undefined || typeof table.keys !== 'function') return;
  let stored;
  try {
    stored = await persistence.list();
  } catch (error) {
    ctx.logger?.warn?.(`delete-session: skipping orphan cache sweep because the session listing failed: ${messageOf(error)}`);
    return;
  }
  const known = new Set(stored.map(snapshot => snapshot.header.id));
  const sessions = ctx.get('sessions');
  for (const session of sessions?.list() ?? []) known.add(session.id);
  for (const sessionId of [...table.keys()]) {
    if (known.has(sessionId)) continue;
    try {
      await table.delete(sessionId);
    } catch (error) {
      ctx.logger?.warn?.(`delete-session: cannot erase the orphan cached projections for ${sessionId}: ${messageOf(error)}`);
    }
  }
}

/**
 * Accept only a plausible Session id: the id is used to build a path segment
 * and a cache filename, and both encodings reject traversal on their own, but
 * a bounded printable id keeps the route's input obvious.
 * @param value - untrusted request field.
 * @returns the accepted id.
 */
function normalizeSessionId(value) {
  if (typeof value !== 'string') {
    throw new DeleteSessionError('sessionId must be a string', 'BAD_REQUEST', 400);
  }
  if (value.length === 0 || value.length > MAX_SESSION_ID_CHARS || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new DeleteSessionError('sessionId is not a valid Session id', 'BAD_REQUEST', 400);
  }
  return value;
}

/**
 * Serve one inspection or deletion request.
 * @param ctx - Host context.
 * @param request - the buffered Connection request.
 * @returns the JSON response.
 */
async function routeRequest(ctx, request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'request body must be JSON', code: 'BAD_REQUEST' }, { status: 400 });
  }
  try {
    const sessionId = normalizeSessionId(body?.sessionId);
    if (body?.action === 'inspect') return Response.json(await inspectSession(ctx, sessionId));
    if (body?.action === 'delete') return Response.json(await purgeSession(ctx, sessionId));
    return Response.json({ message: 'unknown action', code: 'BAD_REQUEST' }, { status: 400 });
  } catch (error) {
    if (error instanceof DeleteSessionError) {
      return Response.json({ message: error.message, code: error.code }, { status: error.status });
    }
    return Response.json({ message: messageOf(error), code: 'INTERNAL' }, { status: 500 });
  }
}

/** Register the hard-delete route for the lifetime of this plugin. */
export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: ROUTE_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: request => routeRequest(ctx, request),
      }),
    'delete-session: hard-delete route',
  );

  // One deferred sweep after both services initialize: a dialog erased while
  // live can checkpoint once during Host shutdown, and that orphan would
  // otherwise keep its cached title and message text on disk.
  ctx.inject(['sessionPersistence', 'sessionProjectionCache'], (childCtx) => {
    const timer = setTimeout(() => {
      void sweepOrphanProjectionRows(childCtx);
    }, ORPHAN_SWEEP_DELAY_MS);
    childCtx.effect(() => () => clearTimeout(timer), 'delete-session: orphan cache sweep');
  });
}

/** Connection carries the route; every other capability is optional and read defensively. */
export const inject = ['connection'];
