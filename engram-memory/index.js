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
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Project that carries memory shared by every workspace. */
const GLOBAL_PROJECT = 'global'
/** Project name used inside a project-local database; the folder is the identity. */
const LOCAL_PROJECT = 'local'
/** Directory, relative to a project, that holds its own Engram database. */
const PROJECT_DB_DIRECTORY = '.dsh-memory'
/** First port tried for a project-local Engram service. */
const PROJECT_PORT_START = 7440
/** Last port tried for a project-local Engram service. */
const PROJECT_PORT_END = 7499
/** How many project databases may stay running before the oldest is stopped. */
const MAX_PROJECT_SERVICES = 8
/** Authenticated route the client half uses to browse and edit memory. */
const ROUTE_PATH = '/api/engram-memory'
/** File that remembers which project databases this machine has opened. */
const REGISTRY_FILE = 'projects.json'
/** Most memories one settings-page listing returns. */
const LIST_LIMIT = 200
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

const MEMORY_PROMPT = `Engram memory is available through the tools \`memory_save\`, \`memory_search\`, \`memory_context\`, and \`memory_delete\`. It is a local database shared by every workspace on this machine.
- Project memory lives in the workspace folder itself (a .dsh-memory directory inside it), so it moves with the folder; it is derived automatically, so never pass a project name.
- At the start of a new session, call \`memory_context\` before answering the first request. Before any answer that may depend on a stored rule, preference, or earlier decision, call \`memory_search\`.
- Save proactively after a decision, a fix, a discovery, a convention, or an explicit user preference. Pass \`scope: "global"\` only for facts that must apply in every project, such as tooling choices, communication preferences, and workflow rules.
- Save durable knowledge only: no secrets, credentials, raw tool output, or per-turn chatter.
- Remove obsolete, wrong, or user-rejected records with \`memory_delete\`: pass their ids, or \`all: true\` to empty one database. It only reaches the current project and the shared global project.`

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
 * Canonicalise a path, answering nothing when the folder is missing.
 * @param directory - the path to resolve.
 * @returns the resolved directory, or `undefined` when it cannot be read.
 */
function safeCanonical(directory) {
  if (typeof directory !== 'string' || directory === '') return undefined
  try {
    const resolved = fs.realpathSync(directory)
    return fs.statSync(resolved).isDirectory() ? resolved : undefined
  } catch {
    return undefined
  }
}

/**
 * Resolve the workspace a tool call runs in: its canonical folder and the
 * database directory that travels with it.
 * @param exec - the tool execution carrying the calling agent.
 * @returns the folder and its database directory, or `undefined` without a session cwd.
 */
function resolveWorkspace(exec) {
  const cwd = sessionCwd(exec)
  if (cwd === undefined) return undefined
  const directory = canonicalPath(cwd)
  return { directory, dbDirectory: path.join(directory, PROJECT_DB_DIRECTORY) }
}

/**
 * Create the project's database directory and keep it out of git.
 * @param dbDirectory - the `<project>/.dsh-memory` directory to prepare.
 */
function prepareDatabaseDirectory(dbDirectory) {
  try {
    fs.mkdirSync(dbDirectory, { recursive: true })
  } catch (error) {
    throw new Error(`project memory cannot be created in ${dbDirectory}: ${error instanceof Error ? error.message : String(error)}`)
  }
  const ignore = path.join(dbDirectory, '.gitignore')
  try {
    fs.writeFileSync(ignore, '*\n', { flag: 'wx' })
  } catch {
    // The ignore file already exists or the folder is read-only; the database still works.
  }
}

/** Harness home that owns durable plugin state. */
function harnessHome() {
  const configured = process.env.DSH_HOME
  return typeof configured === 'string' && configured !== '' ? configured : path.join(os.homedir(), '.dsh')
}

/** Directory of the per-machine project registry. */
function registryDirectory() {
  return path.join(harnessHome(), 'engram-memory')
}

/**
 * Read the project databases opened on this machine.
 * @returns the registered entries, newest last.
 */
function readRegistry() {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(registryDirectory(), REGISTRY_FILE), 'utf8'))
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry?.dbDirectory === 'string' && typeof entry?.directory === 'string') : []
  } catch {
    return []
  }
}

/**
 * Remember one project database so the settings page can list it after a restart.
 * @param directory - the project folder.
 * @param dbDirectory - its `.dsh-memory` directory.
 */
function rememberProject(directory, dbDirectory) {
  const entries = readRegistry().filter((entry) => entry.dbDirectory !== dbDirectory)
  entries.push({ directory, dbDirectory, label: path.basename(directory) || 'project', updatedAt: Date.now() })
  try {
    fs.mkdirSync(registryDirectory(), { recursive: true })
    fs.writeFileSync(path.join(registryDirectory(), REGISTRY_FILE), JSON.stringify(entries.slice(-50), null, 1))
  } catch {
    // A read-only home only loses the settings listing, not the memory itself.
  }
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

/**
 * List a contiguous port range.
 * @param start - first port.
 * @param end - last port, inclusive.
 * @returns the ports in ascending order.
 */
function portRange(start, end) {
  const ports = []
  for (let port = start; port <= end; port += 1) ports.push(port)
  return ports
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
  #dataDir
  #port
  #child
  #owned = false
  #starting

  /**
   * @param config - resolved plugin config with optional `command`, `port`, and `dataDir`.
   */
  constructor(config = {}) {
    this.#command = resolveCommand(config.command)
    this.#dataDir = typeof config.dataDir === 'string' && config.dataDir !== '' ? config.dataDir : undefined
    const configured = Number.isInteger(config.port) && config.port > 0 && config.port < 65_536 ? config.port : undefined
    this.#port = configured ?? (this.#dataDir === undefined ? DEFAULT_PORT : undefined)
  }

  /** Base URL of the local service; only meaningful once a port is known. */
  get base() {
    return `http://127.0.0.1:${this.#port}`
  }

  /** Whether a healthy Engram service already answers on the configured port. */
  async healthy() {
    if (this.#port === undefined) return false
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
   * Start `engram serve` on the configured port, or on the first free port in the
   * project range, and wait for its health endpoint.
   *
   * A port that already answers is never adopted for a project database: that
   * response may belong to another project's service, and adopting it would read
   * and write the wrong database. The shared service on the default port is the
   * one exception, because every profile is meant to share it.
   * @returns fulfillment once the service answers.
   */
  async #start() {
    const candidates = this.#port === undefined ? portRange(PROJECT_PORT_START, PROJECT_PORT_END) : [this.#port]
    for (const port of candidates) {
      if (await this.healthyOn(port)) {
        if (this.#dataDir === undefined) {
          this.#port = port
          return
        }
        continue
      }
      if (await this.#startOn(port)) {
        this.#port = port
        return
      }
    }
    throw new Error(`no free port for engram serve in ${candidates[0]}-${candidates.at(-1)}`)
  }

  /**
   * Start one `engram serve` child on a concrete port.
   * @param port - the port to bind.
   * @returns whether this child owns a healthy service on that port.
   */
  async #startOn(port) {
    let stderr = ''
    let exitCode
    let spawnError
    const environment = this.#dataDir === undefined ? process.env : { ...process.env, ENGRAM_DATA_DIR: this.#dataDir }
    const child = spawn(this.#command, ['serve', String(port)], { stdio: ['ignore', 'ignore', 'pipe'], env: environment })
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
      if (exitCode !== undefined) {
        // The port was taken between the probe and the spawn; the next candidate may be free.
        if (this.#child === child) this.#child = undefined
        this.#owned = false
        if (/in use|address already/i.test(stderr)) return false
        throw new Error(`engram serve exited with code ${exitCode}${stderr.trim() === '' ? '' : `: ${stderr.trim()}`}`)
      }
      if (spawnError !== undefined) throw new Error(`engram could not start: ${spawnError.message}`)
      if (await this.healthyOn(port)) return true
      await sleep(150)
    }
    this.dispose()
    return false
  }

  /**
   * Probe one port's health endpoint.
   * @param port - the port to probe.
   * @returns whether a healthy service answers there.
   */
  async healthyOn(port) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1500) })
      return response.ok
    } catch {
      return false
    }
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
  const lines = [`${index + 1}. ${row.title ?? '(untitled)'} — ${row.projectLabel ?? row.project ?? '?'} · ${row.created_at ?? '?'} · #${row.id ?? '?'}`]
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

const DELETE_DESCRIPTION = `Delete memories from the local Engram database: pass ids, or all=true to empty one database.
Deletion is soft by default; hard=true removes the rows permanently. Only the current project and the shared global project can be reached, never another project's database. Use it for obsolete, wrong, or user-rejected records.`

/**
 * Register the memory tools and the protocol prompt section.
 * @param ctx - Host context with Tools and the system prompt.
 * @param config - optional `command` and `port` for the local Engram service.
 */
export function apply(ctx, config = {}) {
  const settings = config ?? {}
  const globalService = new EngramService(settings)
  /** Project-local services, keyed by their database directory. */
  const projectServices = new Map()

  /**
   * Service that owns one project's database, created on first use. The oldest
   * service is stopped once the cap is reached, which bounds both the number of
   * Engram processes and the ports they hold.
   * @param workspace - the resolved workspace of the calling session.
   * @returns the project-local service, or the global one without a workspace.
   */
  const serviceForProject = (workspace) => {
    if (workspace === undefined) return globalService
    const existing = projectServices.get(workspace.dbDirectory)
    if (existing !== undefined) {
      existing.usedAt = Date.now()
      return existing.service
    }
    prepareDatabaseDirectory(workspace.dbDirectory)
    rememberProject(workspace.directory, workspace.dbDirectory)
    const service = new EngramService({ command: settings.command, dataDir: workspace.dbDirectory })
    projectServices.set(workspace.dbDirectory, { service, usedAt: Date.now() })
    while (projectServices.size > MAX_PROJECT_SERVICES) {
      const oldest = [...projectServices.entries()].sort((left, right) => left[1].usedAt - right[1].usedAt)[0]
      if (oldest === undefined) break
      oldest[1].service.dispose()
      projectServices.delete(oldest[0])
    }
    return service
  }

  /** Cached shared-memory digest; refreshed in the background, never awaited by a request. */
  let digest = ''
  let digestAt = 0
  let digestPending

  /**
   * Services and filters one read covers: the project database plus the shared one.
   * @param exec - the tool execution carrying the calling agent.
   * @param all - whether to read every project in both databases.
   * @returns one target per service, labelled for the model.
   */
  const searchTargets = (exec, all) => {
    const workspace = resolveWorkspaceSafe(exec)
    const targets = []
    if (workspace !== undefined) {
      targets.push({
        service: serviceForProject(workspace),
        project: all ? undefined : LOCAL_PROJECT,
        label: path.basename(workspace.directory) || 'project',
      })
    }
    targets.push({ service: globalService, project: all ? undefined : GLOBAL_PROJECT, label: GLOBAL_PROJECT })
    return targets
  }
  /**
   * Re-read the shared `global` project into the digest cache.
   * @returns fulfillment once the cache holds the current shared memories.
   */
  const refreshDigest = async () => {
    if (digestPending !== undefined) return digestPending
    digestPending = (async () => {
      const rows = await globalService.request(`/observations?project=${GLOBAL_PROJECT}&limit=${DIGEST_LIMIT}`, {})
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
      const scope = args?.scope === 'global' ? 'global' : 'project'
      const workspace = scope === 'global' ? undefined : resolveWorkspaceSafe(exec)
      const service = scope === 'global' ? globalService : serviceForProject(workspace)
      const project = scope === 'global' ? GLOBAL_PROJECT : LOCAL_PROJECT
      const directory = workspace?.directory ?? ''
      const label = scope === 'global' ? GLOBAL_PROJECT : directory === '' ? LOCAL_PROJECT : path.basename(directory)
      const type = MEMORY_TYPES.includes(args?.type) ? args.type : 'manual'
      const title = String(args?.title ?? '').trim()
      const content = String(args?.content ?? '').trim()
      if (title === '' || content === '') return { ok: false, error: 'title and content are required', project: label, directory, scope, type }
      const sessionId = sessionIdFor(exec, project)
      try {
        await service.openSession(sessionId, project, workspace?.directory)
        const saved = await service.request('/observations', {
          method: 'POST',
          signal: exec.signal,
          body: JSON.stringify({ session_id: sessionId, project, scope, type, title, content }),
        })
        if (scope === 'global') void refreshDigest()
        return { ok: true, id: saved?.id ?? 0, project: label, directory, scope, type }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error), project: label, directory, scope, type }
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
      try {
        const targets = searchTargets(exec, args?.all === true)
        const rows = []
        for (const target of targets) {
          const params = new URLSearchParams({ q: query, limit: String(limit) })
          if (target.project !== undefined) params.set('project', target.project)
          const found = await target.service.request(`/search?${params.toString()}`, { signal: exec.signal })
          if (Array.isArray(found)) rows.push(...found.map((row) => ({ ...row, projectLabel: target.label })))
        }
        const results = dedupe(rows).sort(byRelevance).slice(0, limit)
        return { ok: true, query, projects: targets.map((target) => target.label), results }
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
      try {
        const targets = searchTargets(exec, false)
        const rows = []
        for (const target of targets) {
          const filter = target.project === undefined ? '' : `project=${encodeURIComponent(target.project)}&`
          const found = await target.service.request(`/observations?${filter}limit=${limit}`, { signal: exec.signal })
          if (Array.isArray(found)) rows.push(...found.map((row) => ({ ...row, projectLabel: target.label })))
        }
        const results = dedupe(rows).sort(byRecency).slice(0, limit)
        return { ok: true, projects: targets.map((target) => target.label), results }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error), projects: [], results: [] }
      }
    },
  }), 'engram-memory: memory_context tool')

  ctx.effect(() => ctx.tools.register({
    name: 'memory_delete',
    description: DELETE_DESCRIPTION,
    timeoutMs: 60_000,
    parameters: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'integer' },
          description: 'Ids of the memories to delete, as shown by memory_search or memory_context.',
        },
        all: {
          type: 'boolean',
          description: 'Delete every memory of the targeted database instead of listing ids. Requires scope.',
        },
        scope: {
          type: 'string',
          enum: ['project', 'global'],
          description: 'Which database to delete from: the current project (default) or the shared global one.',
        },
        hard: {
          type: 'boolean',
          description: 'Remove the rows permanently instead of soft-deleting them. Defaults to false.',
        },
      },
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object' },
      render: (args, value) => [{
        type: 'text',
        text: value?.ok === true
          ? `Deleted ${value.deleted.length} memor${value.deleted.length === 1 ? 'y' : 'ies'} from "${value.project}" (${value.scope}, ${value.hard ? 'hard' : 'soft'}).${value.failed.length === 0 ? '' : `\nNot deleted: ${value.failed.map((row) => `#${row.id}: ${row.error}`).join('; ')}`}`
          : `Memory delete failed: ${String(value?.error ?? 'unknown error')}`,
      }],
    },
    execute: async (args, exec) => {
      const scope = args?.scope === 'global' ? 'global' : 'project'
      const hard = args?.hard === true
      const workspace = scope === 'global' ? undefined : resolveWorkspaceSafe(exec)
      const directory = workspace?.directory ?? ''
      const project = scope === 'global' ? GLOBAL_PROJECT : LOCAL_PROJECT
      const label = scope === 'global' ? GLOBAL_PROJECT : directory === '' ? LOCAL_PROJECT : path.basename(directory)
      const ids = Array.isArray(args?.ids) ? args.ids.filter((id) => Number.isInteger(id) && id > 0) : []
      const all = args?.all === true
      const empty = { project: label, scope, hard, deleted: [], failed: [] }
      if (scope === 'project' && workspace === undefined) {
        return { ok: false, error: 'project scope needs a session working directory', ...empty }
      }
      if (!all && ids.length === 0) return { ok: false, error: 'ids or all=true is required', ...empty }
      const service = scope === 'global' ? globalService : serviceForProject(workspace)
      const deleted = []
      const failed = []
      /** Delete one id, recording the failure instead of aborting the whole batch. */
      const deleteOne = async (id) => {
        try {
          await service.request(`/observations/${id}${hard ? '?hard=1' : ''}`, { method: 'DELETE', signal: exec.signal })
          deleted.push(id)
        } catch (error) {
          failed.push({ id, error: error instanceof Error ? error.message : String(error) })
        }
      }
      try {
        if (all) {
          // Re-read after every batch: soft-deleted rows leave the listing, so the
          // loop ends on its own and also picks up records a batch cap kept back.
          for (;;) {
            const batch = await listMemoryIds(service, project)
            if (batch.length === 0) break
            const before = deleted.length + failed.length
            for (const id of batch) await deleteOne(id)
            if (deleted.length + failed.length === before) break
          }
        } else {
          for (const id of ids) await deleteOne(id)
        }
        if (scope === 'global' && deleted.length > 0) void refreshDigest()
        return { ok: true, ...empty, deleted, failed }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error), ...empty, deleted, failed }
      }
    },
  }), 'engram-memory: memory_delete tool')

  ctx.effect(() => ctx.systemPrompt.section({
    name: PROMPT_SECTION,
    order: ctx.systemPrompt.getSectionOrder('TOOL_REPORT') + 10,
    text: () => {
      if (digestPending === undefined && Date.now() - digestAt > DIGEST_TTL_MS) void refreshDigest()
      if (digest === '') return MEMORY_PROMPT
      return `${MEMORY_PROMPT}\n- The most recent shared (global) memories follow at the end of this section; project memories still require \`memory_search\`.\n\nShared global memory, most recent first:\n${digest}`
    },
  }), 'engram-memory: protocol prompt section')

  /**
   * Databases the settings page can browse: the shared one, every DSH workspace,
   * and every project database this machine has already used.
   */
  const memoryProjects = () => {
    const projects = [{ key: GLOBAL_PROJECT, label: GLOBAL_PROJECT, kind: 'global' }]
    const seen = new Set()
    const workspaces = ctx.get?.('workspaceRegistry')
    let listed = []
    try {
      listed = Array.isArray(workspaces?.list?.()) ? workspaces.list() : []
    } catch {
      listed = []
    }
    for (const workspace of listed) {
      const directory = safeCanonical(workspace?.path)
      if (directory === undefined) continue
      const dbDirectory = path.join(directory, PROJECT_DB_DIRECTORY)
      seen.add(dbDirectory)
      projects.push({ key: dbDirectory, label: String(workspace?.title ?? '') || path.basename(directory), kind: 'project' })
    }
    for (const entry of readRegistry()) {
      if (seen.has(entry.dbDirectory)) continue
      if (safeCanonical(entry.directory) === undefined) continue
      seen.add(entry.dbDirectory)
      projects.push({ key: entry.dbDirectory, label: entry.label ?? path.basename(entry.directory), kind: 'project' })
    }
    return projects
  }

  /**
   * Resolve one settings-page database key into its service and Engram project.
   * @param key - `global` or a project database directory.
   * @returns the service and the project name inside it.
   */
  const memoryTarget = (key) => {
    if (key === GLOBAL_PROJECT) return { service: globalService, project: GLOBAL_PROJECT }
    const directory = safeCanonical(path.dirname(String(key ?? '')))
    if (directory === undefined || path.basename(String(key)) !== PROJECT_DB_DIRECTORY) {
      throw new Error('this project memory is unknown')
    }
    return { service: serviceForProject({ directory, dbDirectory: path.join(directory, PROJECT_DB_DIRECTORY) }), project: LOCAL_PROJECT }
  }

  /**
   * Settings endpoint behind the Plugins page section.
   * @param request - buffered POST request with `action` and its fields.
   * @returns the JSON answer.
   */
  const route = async (request) => {
    let body = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    const action = typeof body?.action === 'string' ? body.action : ''
    try {
      if (action === 'projects') return Response.json({ ok: true, projects: memoryProjects() })
      if (action === 'list') {
        const target = memoryTarget(body?.key)
        const rows = await target.service.request(`/observations?project=${encodeURIComponent(target.project)}&limit=${LIST_LIMIT}`, {})
        return Response.json({ ok: true, entries: Array.isArray(rows) ? rows : [] })
      }
      if (action === 'update' || action === 'delete') {
        const target = memoryTarget(body?.key)
        const id = Number(body?.id)
        if (!Number.isInteger(id) || id <= 0) return Response.json({ ok: false, error: 'a memory id is required' })
        if (action === 'delete') {
          await target.service.request(`/observations/${id}`, { method: 'DELETE' })
        } else {
          const title = String(body?.title ?? '').trim()
          const content = String(body?.content ?? '').trim()
          if (title === '' || content === '') return Response.json({ ok: false, error: 'title and content are required' })
          await target.service.request(`/observations/${id}`, { method: 'PATCH', body: JSON.stringify({ title, content }) })
        }
        if (target.project === GLOBAL_PROJECT) void refreshDigest()
        return Response.json({ ok: true })
      }
      return Response.json({ ok: false, error: 'unknown action' }, { status: 400 })
    } catch (error) {
      return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  ctx.effect(() => ctx.connection.fetch.register({
    path: ROUTE_PATH,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: route,
  }), 'engram-memory: settings route')

  ctx.effect(() => () => {
    for (const { service } of projectServices.values()) service.dispose()
    globalService.dispose()
  }, 'engram-memory: local services')
}

/** Resolve the workspace for a tool call, tolerating a missing agent context. */
function resolveWorkspaceSafe(exec) {
  try {
    return resolveWorkspace(exec)
  } catch {
    return undefined
  }
}

/** Clamp one `limit` argument into the accepted range. */
function clampLimit(value, fallback) {
  if (!Number.isFinite(value)) return fallback
  const limit = Math.trunc(value)
  return limit < 1 ? 1 : limit > 20 ? 20 : limit
}

/**
 * List every live memory id in one database.
 * @param service - the Engram service that owns the database.
 * @param project - the Engram project to restrict the listing to.
 * @returns the ids in listing order.
 */
async function listMemoryIds(service, project) {
  const params = new URLSearchParams({ limit: String(LIST_LIMIT) })
  if (project !== undefined) params.set('project', project)
  const rows = await service.request(`/observations?${params.toString()}`, {})
  return Array.isArray(rows)
    ? rows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0)
    : []
}

/** Tools and the system prompt carry the whole model surface. */
export const inject = ['connection', 'tools', 'systemPrompt']
