/**
 * Host half of the anonymous-session bundle.
 *
 * The browser half starts a standard Session in a dedicated, project-free
 * workspace — the shipped "New session" flow with an explicit workspace, so no
 * directory picker appears. This half owns the two things a browser cannot do:
 * prepare that workspace's directory on disk and register the workspace with
 * the Host workspace registry.
 *
 * The operation is idempotent: every call returns the same workspace for the
 * same directory, retitling it to the caller's localized title.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Authenticated Connection route the browser half posts to. */
const ROUTE_PATH = '/api/anonymous-session';

/** Fallback workspace title used when the caller sends none. */
const DEFAULT_TITLE = 'Anonymous sessions';

/** Longest workspace title accepted from the browser. */
const MAX_TITLE_CHARS = 120;

/** A request-level failure with a stable code, rendered verbatim by the panel. */
class AnonymousSessionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AnonymousSessionError';
    this.code = code;
  }
}

/** Narrow an unknown thrown value to a human-readable message. */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/** The DSH home that owns durable state for this installation. */
function hostHome() {
  const configured = process.env.DSH_HOME;
  if (typeof configured === 'string' && configured.length > 0) return configured;
  return path.join(os.homedir(), '.dsh');
}

/**
 * The directory anonymous sessions work in: one durable, empty folder that
 * belongs to no project. Sessions are attached to the workspace registered for
 * this exact path, so the Host records it as their working directory.
 */
function ensureDirectory() {
  const directory = path.join(hostHome(), 'anonymous');
  try {
    fs.mkdirSync(directory, { recursive: true });
    if (!fs.statSync(directory).isDirectory()) {
      throw new AnonymousSessionError(`the anonymous-session path is not a directory: ${directory}`, 'DIRECTORY_UNAVAILABLE');
    }
  } catch (error) {
    if (error instanceof AnonymousSessionError) throw error;
    throw new AnonymousSessionError(`cannot prepare the anonymous-session directory ${JSON.stringify(directory)}: ${messageOf(error)}`, 'DIRECTORY_UNAVAILABLE');
  }
  return directory;
}

/** Accept a caller-supplied title, trimmed and bounded; undefined otherwise. */
function normalizedTitle(value) {
  if (typeof value !== 'string') return undefined;
  const title = value.trim().slice(0, MAX_TITLE_CHARS);
  return title.length === 0 ? undefined : title;
}

/**
 * Resolve (creating on first use) the anonymous workspace.
 *
 * `workspaceRegistry.create` canonicalizes the path and returns the existing
 * workspace for a repeated path, so this call is safe on every click. The title
 * follows the caller's current locale; an unchanged title costs no write.
 */
async function ensureWorkspace(ctx, title) {
  const registry = ctx.get('workspaceRegistry');
  if (registry === undefined) {
    throw new AnonymousSessionError('anonymous sessions are unavailable: this profile mounts no workspace registry', 'WORKSPACE_UNAVAILABLE');
  }
  const directory = ensureDirectory();
  const workspace = await registry.create(directory, title);
  if (workspace.title !== title) await workspace.setTitle(title);
  return { workspaceId: String(workspace.id), path: workspace.path, title: workspace.title };
}

/**
 * Serve one preparation request: JSON `{ workspaceId, path, title }`.
 * The body is optional; `{ "title": "…" }` localizes the workspace name.
 */
async function routeRequest(ctx, request) {
  let title = DEFAULT_TITLE;
  try {
    const body = await request.json();
    title = normalizedTitle(body?.title) ?? DEFAULT_TITLE;
  } catch {
    // A request without a JSON body still prepares the workspace.
  }
  try {
    return Response.json(await ensureWorkspace(ctx, title));
  } catch (error) {
    return Response.json(
      { message: messageOf(error), code: error?.code ?? 'WORKSPACE_UNAVAILABLE' },
      { status: 503 },
    );
  }
}

/** Register the workspace-preparation route for the lifetime of this plugin. */
export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: ROUTE_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: (request) => routeRequest(ctx, request),
      }),
    'anonymous-session: workspace route',
  );
}

/** Connection carries the route; the workspace registry stays optional. */
export const inject = ['connection'];
