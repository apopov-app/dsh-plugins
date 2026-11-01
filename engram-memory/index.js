/**
 * Project-scoped memory for DeepSeek Harness, backed by a local Engram service.
 *
 * DSH starts MCP servers in the profile directory, so an MCP memory server
 * cannot tell which workspace a session belongs to and needs a hand-typed
 * project name on every call. This bundle owns the memory surface instead:
 * every tool resolves the project from the calling agent's session working
 * directory, starts the Engram HTTP service when it is not running, and keeps
 * one shared `global` project for facts that must travel between workspaces.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Project that carries memory shared by every workspace. */
const GLOBAL_PROJECT = 'global'
/** Local Engram HTTP port used when the profile does not configure another one. */
const DEFAULT_PORT = 7437
/** System-prompt section that teaches the model the memory protocol. */
const PROMPT_SECTION = 'engram-memory:protocol'
/** Longest memory text rendered back to the model for one record. */
const MAX_RENDER_CHARS = 700
/** Deadline for a cold Engram service start. */
const START_TIMEOUT_MS = 10_000
/** Deadline for one Engram HTTP request. */
const REQUEST_TIMEOUT_MS = 20_000
/** Shared memories listed automatically in the system prompt. */
const DIGEST_LIMIT = 12
/** Characters of each shared memory body quoted in the digest. */
const DIGEST_CHARS = 160
/** How long a cached digest is trusted before a background refresh. */
const DIGEST_TTL_MS = 30_000

/** Observation types Engram accepts for a manual memory. */
const MEMORY_TYPES = ['manual', 'decision', 'architecture', 'bugfix', 'pattern', 'config', 'discovery', 'learning']

const MEMORY_PROMPT = `Engram memory is available through the tools \`memory_save\`, \`memory_search\`, and \`memory_context\`. It is a local database shared by every workspace on this machine.
- The active project is a stable hash of the session's absolute working directory; it is derived automatically, so never pass a project name.
- At the start of a new session, call \`memory_context\` before answering the first request. Before any answer that may depend on a stored rule, preference, or earlier decision, call \`memory_search\`.
- Save proactively after a decision, a fix, a discovery, a convention, or an explicit user preference. Pass \`scope: "global"\` only for facts that must apply in every project, such as tooling choices, communication preferences, and workflow rules.
- Save durable knowledge only: no secrets, credentials, raw tool output, or per-turn chatter.`

/**
 * Compose the shared-memory digest injected into every system prompt.
 * @param rows - recent observations of the shared `global` project.
 * @returns one `- title: body` line per memory, most recent first.
 */
function digestText(rows) {
  const lines = []
  for (const row of rows) {
    const title = String(row?.title ?? '').trim()
    if (title === '') continue
    const body = String(row?.content ?? '').replace(/\s+/gu, ' ').trim().slice(0, DIGEST_CHARS)
    lines.push(body === '' ? `- ${title}` : `- ${title}: ${body}`)
  }
  return lines.join('\n')
}

/**
 * Resolve the Engram executable: the configured command, an explicit environment
 * override, the Go install directory, or the PATH lookup.
 * @param configured - the profile's `command` config value.
 * @returns the executable to spawn.
 */
function resolveCommand(configured) {
  if (typeof configured === 'string' && configured.trim() !== '') return configured.trim()
  const fromEnvironment = process.env.ENGRAM_BIN
  if (typeof fromEnvironment === 'string' && fromEnvironment.trim() !== '') return fromEnvironment.trim()
  const goBin = path.join(os.homedir(), 'go', 'bin', 'engram')
  try {
    if (fs.statSync(goBin).isFile()) return goBin
  } catch {
    // No Go install on this machine; fall through to the PATH lookup.
  }
  return 'engram'
}

/** Resolve the session working directory a tool call runs in. */
function sessionCwd(exec) {
  const cwd = exec?.agent?.session?.header?.cwd
  return typeof cwd === 'string' && path.isAbsolute(cwd) ? cwd : undefined
}

/**
 * Canonicalise a working directory so two spellings, symlinks, and case variants
 * of the same folder resolve to one identity.
 * @param directory - the session working directory.
 * @returns the resolved absolute path, or the lexical path when it cannot be read.
 */
function canonicalPath(directory) {
  try {
    return fs.realpathSync(directory)
  } catch {
    return path.resolve(directory)
  }
}

/**
 * Build a collision-free project name from an absolute path: a readable folder
 * label plus the first eight hex digits of the path's SHA-256 digest.
 * @param directory - the canonical absolute path.
 * @returns the project name, such as `deepseek-1f3c9a04`.
 */
function projectNameForPath(directory) {
  const digest = createHash('sha256').update(directory).digest('hex').slice(0, 8)
  const label = path.basename(directory)
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 48)
  return `${label === '' ? 'project' : label}-${digest}`
}

/**
 * Read a repository-level project name from `.engram/config.json`.
 * @param directory - the canonical session working directory.
 * @returns the configured project name, when one exists.
 */
function configuredProject(directory) {
  if (directory === undefined) return undefined
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(directory, '.engram', 'config.json'), 'utf8'))
    const name = parsed?.project_name
    return typeof name === 'string' && name.trim() !== '' ? name.trim() : undefined
  } catch {
    return undefined
  }
}

/**
 * Resolve the Engram project and the directory it belongs to for one tool call.
 * @param exec - the tool execution carrying the calling agent.
 * @returns the project name and its absolute directory; `global` has no directory.
 */
function resolveProject(exec) {
  const cwd = sessionCwd(exec)
  if (cwd === undefined) return { project: GLOBAL_PROJECT, directory: undefined }
  const directory = canonicalPath(cwd)
  return { project: configuredProject(directory) ?? projectNameForPath(directory), directory }
}

/**
 * A stable Engram session id for one DSH session and project pair. The project
 * is part of the id because Engram rejects observations whose project differs
 * from their session's project, and one DSH session can change directory.
 */
function sessionIdFor(exec, project) {
  const agentId = String(exec?.agent?.id ?? 'anonymous')
  return `dsh-${agentId}-${project}`
}

/** Wait for a fixed delay. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Trim one memory body for the model-facing projection. */
function preview(text, limit = MAX_RENDER_CHARS) {
  const value = typeof text === 'string' ? text.trim() : ''
  return value.length <= limit ? value : `${value.slice(0, limit)}…`
}

/**
 * Local Engram HTTP service: reused when one is already listening, started on
 * demand otherwise, and stopped again only when this plugin started it.
 */
class EngramService {
  #command
  #port
  #child
  #owned = false
  #starting

  /**
   * @param config - resolved plugin config with optional `command` and `port`.
   */
  constructor(config = {}) {
    this.#command = resolveCommand(config.command)
    this.#port = Number.isInteger(config.port) && config.port > 0 && config.port < 65_536 ? config.port : DEFAULT_PORT
  }

  /** Base URL of the local service. */
  get base() {
    return `http://127.0.0.1:${this.#port}`
  }

  /** Whether a healthy Engram service already answers on the configured port. */
  async healthy() {
    try {
      const response = await fetch(`${this.base}/health`, { signal: AbortSignal.timeout(1500) })
      return response.ok
    } catch {
      return false
    }
  }

  /** Make sure the service answers, starting it when absent. */
  async ensure() {
    if (await this.healthy()) return
    if (this.#starting === undefined) {
      this.#starting = this.#start().finally(() => {
        this.#starting = undefined
      })
    }
    await this.#starting
  }

  /**
   * Start `engram serve` and wait for its health endpoint.
   * @returns fulfillment once the service answers.
   */
  async #start() {
    let stderr = ''
    let exitCode
    let spawnError
    const child = spawn(this.#command, ['serve', String(this.#port)], { stdio: ['ignore', 'ignore', 'pipe'] })
    child.stderr?.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-2000)
    })
    child.once('exit', (code) => {
      exitCode = code
      if (this.#child === child) this.#child = undefined
    })
    child.once('error', (error) => {
      spawnError = error
    })
    this.#child = child
    this.#owned = true
    const deadline = Date.now() + START_TIMEOUT_MS
    while (Date.now() < deadline) {
      if (await this.healthy()) return
      if (spawnError !== undefined) throw new Error(`engram could not start: ${spawnError.message}`)
      if (exitCode !== undefined) {
        throw new Error(`engram serve exited with code ${exitCode}${stderr.trim() === '' ? '' : `: ${stderr.trim()}`}`)
      }
      await sleep(150)
    }
    this.dispose()
    throw new Error('engram serve did not become healthy in time')
  }

  /**
   * Call one JSON endpoint on the local service.
   * @param pathname - path with its query string.
   * @param init - fetch options; `signal` is combined with a request deadline.
   * @returns the decoded JSON body.
   */
  async request(pathname, init = {}) {
    await this.ensure()
    const deadline = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    const signal = init.signal === undefined ? deadline : AbortSignal.any([init.signal, deadline])
    const response = await fetch(`${this.base}${pathname}`, {
      ...init,
      signal,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    })
    const text = await response.text()
    let value
    try {
      value = text === '' ? undefined : JSON.parse(text)
    } catch {
      value = undefined
    }
    if (!response.ok) {
      const message = value?.error ?? value?.message ?? text.slice(0, 300)
      throw new Error(`Engram responded ${response.status}: ${message}`)
    }
    return value
  }

  /**
   * Ensure one Engram session exists for a DSH session and project.
   * @param id - the Engram session id.
   * @param project - the project the session writes to.
   */
  /**
   * Ensure one Engram session exists for a DSH session and project.
   * @param id - the Engram session id.
   * @param project - the project the session writes to.
   * @param directory - the absolute working directory that produced the project.
   */
  async openSession(id, project, directory) {
    const body = directory === undefined ? { id, project } : { id, project, directory }
    await this.request('/sessions', { method: 'POST', body: JSON.stringify(body) })
  }

  /** Stop the service, but only when this plugin started it. */
  dispose() {
    if (!this.#owned || this.#child === undefined) return
    this.#child.kill()
    this.#child = undefined
    this.#owned = false
  }
}

/** Deduplicate observations that arrive from more than one project search. */
function dedupe(rows) {
  const seen = new Map()
  for (const row of rows) {
    if (row === undefined || row === null) continue
    const key = row.sync_id ?? row.id
    if (seen.has(key)) continue
    seen.set(key, row)
  }
  return [...seen.values()]
}

/** Order search hits by full-text rank, then by recency. */
function byRelevance(left, right) {
  const difference = Number(left.rank ?? 0) - Number(right.rank ?? 0)
  if (difference !== 0) return difference
  return String(right.created_at ?? '').localeCompare(String(left.created_at ?? ''))
}

/** Order observations by recency. */
function byRecency(left, right) {
  return String(right.created_at ?? '').localeCompare(String(left.created_at ?? ''))
}

/** Render one observation for the model. */
function renderObservation(row, index) {
  const lines = [`${index + 1}. ${row.title ?? '(untitled)'} — ${row.project ?? '?'} · ${row.created_at ?? '?'} · #${row.id ?? '?'}`]
  const body = preview(row.content)
  if (body !== '') lines.push(body)
  return lines.join('\n')
}

/** Tool description shared by the memory surface. */
const SAVE_DESCRIPTION = `Save one durable memory to the local Engram database and scope it to the current project automatically.
Call this proactively after a decision, a fix, a discovery, a convention, or an explicit user preference. Pass scope "global" only when the fact must apply in every project. Do not save secrets, credentials, raw tool output, or per-turn chatter.`

const SEARCH_DESCRIPTION = `Search the local Engram memory: the current project plus the shared global project, or every project with all=true.
Call this before asking the user to repeat context, and when a past decision, fix, or convention may already be recorded.`

const CONTEXT_DESCRIPTION = `Show the most recent memories for the current project and the shared global project.
Call this at the start of a session or after a context compaction to recover what happened before.`

/**
 * Register the memory tools and the protocol prompt section.
 * @param ctx - Host context with Tools and the system prompt.
 * @param config - optional `command` and `port` for the local Engram service.
 */
export function apply(ctx, config = {}) {
  const service = new EngramService(config ?? {})
  /** Cached shared-memory digest; refreshed in the background, never awaited by a request. */
  let digest = ''
  let digestAt = 0
  let digestPending

  /**
   * Re-read the shared `global` project into the digest cache.
   * @returns fulfillment once the cache holds the current shared memories.
   */
  const refreshDigest = async () => {
    if (digestPending !== undefined) return digestPending
    digestPending = (async () => {
      const rows = await service.request(`/observations?project=${GLOBAL_PROJECT}&limit=${DIGEST_LIMIT}`, {})
      digest = digestText(Array.isArray(rows) ? rows : [])
      digestAt = Date.now()
    })()
      .catch(() => {})
      .finally(() => {
        digestPending = undefined
      })
    return digestPending
  }

  // Warm the digest at load so the first turn of a fresh app already carries the
  // shared memories; a slow or missing Engram service only leaves it empty.
  void refreshDigest()

  ctx.effect(() => ctx.tools.register({
    name: 'memory_save',
    description: SAVE_DESCRIPTION,
    timeoutMs: 30_000,
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short, searchable title, such as "JWT auth middleware" or "Fixed FTS5 quoting".',
        },
        content: {
          type: 'string',
          description: 'The memory itself: what was done, why, where it lives, and what was learned.',
        },
        type: {
          type: 'string',
          enum: MEMORY_TYPES,
          description: 'Category of the memory. Defaults to "manual".',
        },
        scope: {
          type: 'string',
          enum: ['project', 'global'],
          description: 'Use "project" (default) for repository knowledge and "global" for facts that follow the user into every project.',
        },
      },
      required: ['title', 'content'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object' },
      render: (args, value) => [{
        type: 'text',
        text: value?.ok === true
          ? `Saved "#${value.id}" to project "${value.project}" (${value.scope}, ${value.type}).${value.directory === '' ? '' : `\nDirectory: ${value.directory}`}`
          : `Memory was not saved: ${String(value?.error ?? 'unknown error')}`,
      }],
    },
    execute: async (args, exec) => {
      const target = args?.scope === 'global'
        ? { project: GLOBAL_PROJECT, directory: undefined }
        : resolveProjectSafe(exec)
      const project = target.project
      const directory = target.directory ?? ''
      const scope = args?.scope === 'global' ? 'global' : 'project'
      const type = MEMORY_TYPES.includes(args?.type) ? args.type : 'manual'
      const title = String(args?.title ?? '').trim()
      const content = String(args?.content ?? '').trim()
      if (title === '' || content === '') return { ok: false, error: 'title and content are required', project, directory, scope, type }
      const sessionId = sessionIdFor(exec, project)
      try {
        await service.openSession(sessionId, project, target.directory)
        const saved = await service.request('/observations', {
          method: 'POST',
          signal: exec.signal,
          body: JSON.stringify({ session_id: sessionId, project, scope, type, title, content }),
        })
        if (scope === 'global') void refreshDigest()
        return { ok: true, id: saved?.id ?? 0, project, directory, scope, type }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error), project, directory, scope, type }
      }
    },
  }), 'engram-memory: memory_save tool')

  ctx.effect(() => ctx.tools.register({
    name: 'memory_search',
    description: SEARCH_DESCRIPTION,
    timeoutMs: 30_000,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords or a natural-language phrase to look for.' },
        limit: { type: 'integer', description: 'Maximum number of memories to return. Defaults to 8, at most 20.' },
        all: { type: 'boolean', description: 'Search every project instead of the current project plus global.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object' },
      render: (args, value) => [{
        type: 'text',
        text: value?.ok === true
          ? (value.results.length === 0
              ? `No memories matched "${value.query}" in ${value.projects.join(' + ')}.`
              : `Found ${value.results.length} memor${value.results.length === 1 ? 'y' : 'ies'} for "${value.query}" (${value.projects.join(' + ')}):\n\n${value.results.map((row, index) => renderObservation(row, index)).join('\n\n')}`)
          : `Memory search failed: ${String(value?.error ?? 'unknown error')}`,
      }],
    },
    execute: async (args, exec) => {
      const query = String(args?.query ?? '').trim()
      const limit = clampLimit(args?.limit, 8)
      if (query === '') return { ok: false, error: 'query is required', query, projects: [], results: [] }
      const project = resolveProjectSafe(exec).project
      const projects = args?.all === true ? [undefined] : project === GLOBAL_PROJECT ? [GLOBAL_PROJECT] : [project, GLOBAL_PROJECT]
      try {
        const rows = []
        for (const target of projects) {
          const params = new URLSearchParams({ q: query, limit: String(limit) })
          if (target !== undefined) params.set('project', target)
          const found = await service.request(`/search?${params.toString()}`, { signal: exec.signal })
          if (Array.isArray(found)) rows.push(...found)
        }
        const results = dedupe(rows).sort(byRelevance).slice(0, limit)
        return { ok: true, query, projects: projects.map((target) => target ?? 'all projects'), results }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error), query, projects: [], results: [] }
      }
    },
  }), 'engram-memory: memory_search tool')

  ctx.effect(() => ctx.tools.register({
    name: 'memory_context',
    description: CONTEXT_DESCRIPTION,
    timeoutMs: 30_000,
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Maximum number of recent memories to return. Defaults to 5, at most 20.' },
      },
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object' },
      render: (args, value) => [{
        type: 'text',
        text: value?.ok === true
          ? (value.results.length === 0
              ? `No memories yet in ${value.projects.join(' + ')}.`
              : `Recent memories (${value.projects.join(' + ')}):\n\n${value.results.map((row, index) => renderObservation(row, index)).join('\n\n')}`)
          : `Memory context failed: ${String(value?.error ?? 'unknown error')}`,
      }],
    },
    execute: async (args, exec) => {
      const limit = clampLimit(args?.limit, 5)
      const project = resolveProjectSafe(exec).project
      const projects = project === GLOBAL_PROJECT ? [GLOBAL_PROJECT] : [project, GLOBAL_PROJECT]
      try {
        const rows = []
        for (const target of projects) {
          const found = await service.request(`/observations?project=${encodeURIComponent(target)}&limit=${limit}`, { signal: exec.signal })
          if (Array.isArray(found)) rows.push(...found)
        }
        const results = dedupe(rows).sort(byRecency).slice(0, limit)
        return { ok: true, projects, results }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error), projects, results: [] }
      }
    },
  }), 'engram-memory: memory_context tool')

  ctx.effect(() => ctx.systemPrompt.section({
    name: PROMPT_SECTION,
    order: ctx.systemPrompt.getSectionOrder('TOOL_REPORT') + 10,
    text: () => {
      if (digestPending === undefined && Date.now() - digestAt > DIGEST_TTL_MS) void refreshDigest()
      if (digest === '') return MEMORY_PROMPT
      return `${MEMORY_PROMPT}\n- The most recent shared (global) memories follow at the end of this section; project memories still require \`memory_search\`.\n\nShared global memory, most recent first:\n${digest}`
    },
  }), 'engram-memory: protocol prompt section')

  ctx.effect(() => () => service.dispose(), 'engram-memory: local service')
}

/** Resolve a project for a tool call, tolerating a missing agent context. */
function resolveProjectSafe(exec) {
  try {
    return resolveProject(exec)
  } catch {
    return { project: GLOBAL_PROJECT, directory: undefined }
  }
}

/** Clamp one `limit` argument into the accepted range. */
function clampLimit(value, fallback) {
  if (!Number.isFinite(value)) return fallback
  const limit = Math.trunc(value)
  return limit < 1 ? 1 : limit > 20 ? 20 : limit
}

/** Tools and the system prompt carry the whole model surface. */
export const inject = ['tools', 'systemPrompt']
