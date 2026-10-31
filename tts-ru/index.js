/**
 * Host half of the Russian voice-replies bundle.
 *
 * DSH has no text-to-speech subsystem, so this bundle owns both halves of one
 * feature: it registers a `speak_summary` Tool the model calls with a short
 * takeaway, synthesizes that text locally with a Piper Russian voice, and keeps
 * the resulting WAV in memory for the browser half to play. Nothing is spoken
 * unless the user enables the composer speaker toggle, which also flips the
 * system-prompt section that tells the model to write spoken summaries.
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';

const require = createRequire(import.meta.url);
const seekBzip = require('seek-bzip');

/** Tool name the model calls; the browser half keys its tool view by it. */
const TOOL_NAME = 'speak_summary';
/** Authenticated Connection route shared by the browser half. */
const ROUTE_PATH = '/api/tts-ru';
/** Prompt section that advertises the enabled mode to the model. */
const PROMPT_SECTION = 'tts-ru:voice-replies';
/** Longest spoken summary accepted from the model. */
const MAX_SUMMARY_CHARS = 400;
/** Cap on in-memory rendered clips; the oldest clip leaves first. */
const MAX_CLIPS = 32;

/** Russian piper voices converted for sherpa-onnx, pinned by revision. */
const VOICES = Object.freeze([
  { id: 'irina', title: 'Ирина (женский)', gender: 'female', repo: 'csukuangfj/vits-piper-ru_RU-irina-medium', revision: 'b095bed45c39813266edf14ffa2bade5ebfc929c', file: 'ru_RU-irina-medium.onnx', bytes: 63_201_422, tokensBytes: 899 },
  { id: 'dmitri', title: 'Дмитрий (мужской)', gender: 'male', repo: 'csukuangfj/vits-piper-ru_RU-dmitri-medium', revision: '51cc3e9ea521e33ef3771f11e02b29ecb42a91f1', file: 'ru_RU-dmitri-medium.onnx', bytes: 63_201_422, tokensBytes: 907 },
  { id: 'denis', title: 'Денис (мужской)', gender: 'male', repo: 'csukuangfj/vits-piper-ru_RU-denis-medium', revision: '1e2f78fc13100abc60bf56264dc2ee254b4c5f8e', file: 'ru_RU-denis-medium.onnx', bytes: 63_201_422, tokensBytes: 907 },
  { id: 'ruslan', title: 'Руслан (мужской)', gender: 'male', repo: 'csukuangfj/vits-piper-ru_RU-ruslan-medium', revision: '22c226825c24319e30cbf8a3844a240b9f6b1951', file: 'ru_RU-ruslan-medium.onnx', bytes: 63_201_422, tokensBytes: 921 },
]);
const VOICE_BY_ID = new Map(VOICES.map((voice) => [voice.id, voice]));
/** Default downloadable voice. */
const DEFAULT_VOICE = 'irina';
/**
 * Prosody presets for the VITS model. `noiseScale` drives the pitch/energy
 * variation of the generated speech, `noiseScaleW` how unevenly durations are
 * drawn; both are engine-level inputs (Piper's own defaults are 0.667 / 0.8),
 * so switching a preset rebuilds the synthesizer.
 */
const INTONATIONS = Object.freeze({
  calm: { noiseScale: 0.45, noiseScaleW: 0.5 },
  neutral: { noiseScale: 0.667, noiseScaleW: 0.8 },
  expressive: { noiseScale: 0.95, noiseScaleW: 1 },
});
/** Intonation used until the person picks another one. */
const DEFAULT_INTONATION = 'neutral';
/** Speaking-rate presets, applied per clip as a per-call speed multiplier. */
const RATES = Object.freeze({ slow: 0.85, normal: 1, fast: 1.15 });
/** Speaking rate used until the person picks another one. */
const DEFAULT_RATE = 'normal';
/** espeak-ng phoneme data required by the phoneme-based Piper voices. */
const ESPEAK = Object.freeze({
  url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/espeak-ng-data.tar.bz2',
  bytes: 7_252_012,
  sha256: '4135ccf82e1f40613491c0874d4945ae9e9c7840933d8e25a6f9e003d9ebf533',
});
/** Model download origins, tried in order. */
const ORIGINS = ['https://huggingface.co', 'https://hf-mirror.com'];

/** Instruction injected into the system prompt while voice replies are enabled. */
const VOICE_PROMPT = `Voice replies are enabled: the user hears short spoken lines in addition to the written answer.
Announce work before you start it. When you are about to begin a work phase that will use tools — fixing something, editing files, running commands, or a longer research pass — call \`speak_summary\` once with kind "intro" and one short sentence in the user's language that names the task, like "Приступаю к исправлению плагина". Announce each work phase once, right before its first tool call; do not announce trivial read-only steps and do not repeat the same intro.
Narrate the work as it happens. After each meaningful milestone — a cause found, a fix applied, a batch of edits finished, a long command or check started or finished, a plan changed — call \`speak_summary\` once with kind "progress" and one short sentence in the user's language, like "Причину нашёл, теперь правлю воркер". Keep it to a few lines per task, speak only parts worth hearing, and never repeat a line you already spoke.
After every single answer, including short confirmations, one-line replies, and trivial acknowledgements, call \`speak_summary\` exactly once with kind "summary" and a 2-3 sentence spoken takeaway in the user's language (at most 400 characters): the key takeaway a person would say out loud, not a restatement of the full answer.
Write all of them as plain spoken prose: no markdown, no code, no lists, no tool names. Do not repeat the summary in the visible answer.`;

/**
 * Keep every first-person reference in the grammatical gender of the selected
 * voice, so a female voice never says "я нашёл" and a male voice never says
 * "я нашла". Covers the written answer as well as the spoken lines.
 * @param voice - the selected voice descriptor from {@link VOICES}.
 */
function genderPrompt(voice) {
  const title = voice?.title ?? 'Ирина (женский)';
  if (voice?.gender === 'male') {
    return `The selected voice is ${title}. In gendered languages refer to yourself in masculine grammatical forms in the written answer and in every spoken line: "я проверил", "я нашёл", "я готов", "сделал" — never "я проверила", "нашла", "готова".`;
  }
  return `The selected voice is ${title}. In gendered languages refer to yourself in feminine grammatical forms in the written answer and in every spoken line: "я проверила", "я нашла", "я готова", "сделала" — never "я проверил", "нашёл", "готов".`;
}

/** Pronunciation overrides next to the model cache. */
const PRONUNCIATIONS_FILE = 'pronunciations.json';

/**
 * Compile a `word -> replacement` table into a whole-word replacer. Values are
 * plain text (orthoepic respellings such as "его" -> "ево") or an espeak-ng
 * phoneme string in double brackets (e.g. "[[zvɐˈnʲit]]") when exact phonemes or
 * stress are required. Keys match whole words, case-insensitively.
 * @param table - parsed pronunciation JSON.
 * @returns a function that rewrites one text.
 */
function compilePronunciations(table) {
  const map = new Map();
  for (const [word, value] of Object.entries(table ?? {})) {
    if (typeof word !== 'string' || word === '' || typeof value !== 'string' || value === '') continue;
    map.set(word.toLowerCase(), value);
  }
  if (map.size === 0) return (text) => text;
  const wordPattern = /[\p{L}\p{N}]+(?:[’'\-][\p{L}\p{N}]+)*/gu;
  return (text) => text.replace(wordPattern, (token) => map.get(token.toLowerCase()) ?? token);
}

/** Tool description shown to the model. */
const TOOL_DESCRIPTION = `Send one short spoken line for local text-to-speech playback (at most 400 characters).
Three uses while voice replies are enabled. Before a work phase that uses tools, pass kind "intro" with a one-sentence announcement in the user's language, such as "Приступаю к исправлению плагина". While the work runs, pass kind "progress" with one sentence about a meaningful milestone, such as "Причину нашёл, правлю воркер". After every answer, including short confirmations, pass kind "summary" with a 2-3 sentence takeaway. Write plain prose without markdown or code. The line is synthesized on this machine and played in the browser; it is not the answer text itself.`;

/** Narrow an unknown thrown value to a readable message. */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/** Create an AbortError-compatible rejection for cancellation paths. */
function abortError() {
  const error = new Error('voice summary was cancelled');
  error.name = 'AbortError';
  return error;
}

/** The DSH home that owns durable state for this installation. */
function hostHome() {
  const configured = process.env.DSH_HOME;
  if (typeof configured === 'string' && configured.length > 0) return configured;
  return path.join(os.homedir(), '.dsh');
}

/** Resolve one voice's absolute asset paths. */
function voicePaths(directory, voice) {
  return {
    model: path.join(directory, 'voices', `${voice.id}.onnx`),
    tokens: path.join(directory, 'voices', `${voice.id}.tokens.txt`),
  };
}

/** Whether one voice's assets exist with their pinned sizes (synchronous probe). */
function voiceReady(directory, voice) {
  try {
    const paths = voicePaths(directory, voice);
    const model = fs.statSync(paths.model);
    const tokens = fs.statSync(paths.tokens);
    return model.isFile() && model.size === voice.bytes && tokens.isFile() && tokens.size === voice.tokensBytes;
  } catch {
    return false;
  }
}

/** Whether the extracted espeak-ng phoneme data is present. */
function espeakReady(directory) {
  try {
    const marker = fs.statSync(path.join(directory, 'espeak-ng-data', 'phontab'));
    return marker.isFile();
  } catch {
    return false;
  }
}

/** Decode a NUL-terminated tar string field. */
function tarString(buffer, offset, length) {
  let end = offset;
  while (end < offset + length && buffer[end] !== 0) end += 1;
  return buffer.toString('utf8', offset, end).trim();
}

/**
 * Extract a ustar archive into `target`, rejecting paths that escape it.
 * @param archive - plain uncompressed tar bytes.
 * @param target - existing destination directory.
 */
async function extractTar(archive, target) {
  let offset = 0;
  for (;;) {
    if (offset + 512 > archive.length) break;
    const header = archive.subarray(offset, offset + 512);
    const name = tarString(header, 0, 100);
    if (name === '') break;
    const prefix = tarString(header, 345, 155);
    const full = prefix === '' ? name : `${prefix}/${name}`;
    const type = header[156] === 0 ? '0' : String.fromCharCode(header[156]);
    const size = Number.parseInt(tarString(header, 124, 12) || '0', 8);
    const mode = Number.parseInt(tarString(header, 100, 8) || '644', 8);
    const destination = path.resolve(target, full);
    const relative = path.relative(target, destination);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`refusing to extract outside the model directory: ${full}`);
    offset += 512;
    if (type === '5' || full.endsWith('/')) {
      await fsp.mkdir(destination, { recursive: true });
    } else if (type === '0') {
      await fsp.mkdir(path.dirname(destination), { recursive: true });
      await fsp.writeFile(destination, archive.subarray(offset, offset + size), { mode });
    }
    offset += Math.ceil(size / 512) * 512;
  }
}

/** Read one HTTP resource with progress into a partial file, then rename it. */
async function download(url, target, expectedBytes, signal, onProgress) {
  const partial = `${target}.partial`;
  const response = await fetch(url, { signal, redirect: 'follow' });
  if (!response.ok || response.body === null) throw new Error(`HTTP ${response.status} while downloading ${url}`);
  const handle = await fsp.open(partial, 'w');
  let received = 0;
  try {
    for await (const chunk of response.body) {
      if (signal?.aborted) throw abortError();
      await handle.write(chunk);
      received += chunk.length;
      onProgress?.(received);
    }
  } finally {
    await handle.close();
  }
  if (expectedBytes !== undefined && received !== expectedBytes) {
    await fsp.rm(partial, { force: true }).catch(() => {});
    throw new Error(`${path.basename(target)} downloaded ${received} of ${expectedBytes} bytes`);
  }
  await fsp.rename(partial, target);
}

/** SHA-256 hex digest of one file. */
async function sha256Of(file) {
  const hash = createHash('sha256');
  const handle = await fsp.open(file, 'r');
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    await handle.close();
  }
  return hash.digest('hex');
}

/** Encode mono float samples as a 16-bit PCM WAV. */
function encodeWav(samples, sampleRate) {
  const data = Buffer.alloc(samples.length * 2);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index]));
    data.writeInt16LE(Math.round(value * 0x7fff), index * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Worker-thread owner of the native Piper engine. */
class TtsWorker {
  #worker;
  #pending = new Map();
  #nextId = 1;

  /** Transcribe one text through the worker, restarting it when needed. */
  async synthesize(request, signal) {
    if (this.#worker === undefined) this.#start();
    const worker = this.#worker;
    if (worker === undefined) throw new Error('the Piper engine is not available');
    const id = this.#nextId;
    this.#nextId += 1;
    return await new Promise((resolve, reject) => {
      const onAbort = () => {
        this.#pending.delete(id);
        void this.stop();
        reject(abortError());
      };
      if (signal?.aborted) {
        onAbort();
        return;
      }
      this.#pending.set(id, { resolve, reject, signal, onAbort });
      signal?.addEventListener('abort', onAbort, { once: true });
      worker.postMessage({ type: 'synth', id, ...request });
    });
  }

  #start() {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { name: 'tts-ru-piper' });
    worker.on('message', (message) => this.#onMessage(message));
    worker.on('error', (error) => this.#fail(new Error(`the Piper worker failed: ${messageOf(error)}`)));
    worker.on('exit', (code) => this.#fail(new Error(`the Piper worker exited with code ${code}`)));
    this.#worker = worker;
  }

  #onMessage(message) {
    if (message?.type !== 'result' && message?.type !== 'error') return;
    const pending = this.#pending.get(message.id);
    if (pending === undefined) return;
    this.#pending.delete(message.id);
    pending.signal?.removeEventListener('abort', pending.onAbort);
    if (message.type === 'result') {
      pending.resolve({ samples: message.samples instanceof Float32Array ? message.samples : new Float32Array(message.samples), sampleRate: message.sampleRate, inferenceSeconds: message.inferenceSeconds });
    } else {
      pending.reject(new Error(message.message ?? 'speech synthesis failed'));
    }
  }

  #fail(error) {
    for (const pending of this.#pending.values()) {
      pending.signal?.removeEventListener('abort', pending.onAbort);
      pending.reject(error);
    }
    this.#pending.clear();
    this.#worker = undefined;
  }

  /** Terminate the engine; the next synthesis starts a fresh worker. */
  async stop() {
    const worker = this.#worker;
    this.#worker = undefined;
    for (const pending of this.#pending.values()) {
      pending.signal?.removeEventListener('abort', pending.onAbort);
      pending.reject(new Error('the Piper worker stopped'));
    }
    this.#pending.clear();
    if (worker !== undefined) await worker.terminate().catch(() => {});
  }
}

/** Owns prepared voice assets and their on-demand preparation task. */
class Assets {
  #directory;
  #task;

  constructor(directory) {
    this.#directory = directory;
  }

  get directory() {
    return this.#directory;
  }

  /** Whether the espeak-ng phoneme data and the requested voice are complete. */
  ready(voiceId) {
    const voice = VOICE_BY_ID.get(voiceId);
    return voice !== undefined && espeakReady(this.#directory) && voiceReady(this.#directory, voice);
  }

  /** Start (or join) asset preparation; resolves once everything is verified. */
  prepare(voiceId, signal) {
    if (this.#task !== undefined) return this.#task;
    this.#task = this.#run(voiceId, signal).finally(() => {
      this.#task = undefined;
    });
    return this.#task;
  }

  async #run(voiceId, signal) {
    const voice = VOICE_BY_ID.get(voiceId);
    if (voice === undefined) throw new Error(`unknown voice: ${voiceId}`);
    await fsp.mkdir(path.join(this.#directory, 'voices'), { recursive: true });
    if (!espeakReady(this.#directory)) {
      const archive = path.join(this.#directory, 'espeak-ng-data.tar.bz2');
      const url = ESPEAK.url;
      await download(url, archive, ESPEAK.bytes, signal);
      const digest = await sha256Of(archive);
      if (digest !== ESPEAK.sha256) throw new Error('the espeak-ng phoneme data failed its integrity check');
      const compressed = await fsp.readFile(archive);
      const decoded = seekBzip.decode(compressed);
      await extractTar(decoded, this.#directory);
      await fsp.rm(archive, { force: true });
    }
    if (!voiceReady(this.#directory, voice)) {
      const target = voicePaths(this.#directory, voice);
      let lastError;
      for (const origin of ORIGINS) {
        try {
          await download(`${origin}/${voice.repo}/resolve/${voice.revision}/${voice.file}`, target.model, voice.bytes, signal);
          await download(`${origin}/${voice.repo}/resolve/${voice.revision}/tokens.txt`, target.tokens, voice.tokensBytes, signal);
          lastError = undefined;
          break;
        } catch (error) {
          if (signal?.aborted) throw error;
          lastError = error;
          await fsp.rm(target.model, { force: true }).catch(() => {});
          await fsp.rm(target.tokens, { force: true }).catch(() => {});
        }
      }
      if (lastError !== undefined) throw lastError;
    }
    if (!this.ready(voice.id)) throw new Error(`the ${voice.id} voice could not be prepared`);
  }
}

/** In-memory store of rendered clips addressed by a stable content hash. */
class ClipStore {
  #clips = new Map();

  /** Store one clip and return its id. */
  put(text, voiceId, wav, seconds) {
    const id = createHash('sha256').update(`${voiceId}\n${text}`).digest('hex').slice(0, 20);
    this.#clips.delete(id);
    this.#clips.set(id, { wav, seconds, text });
    while (this.#clips.size > MAX_CLIPS) {
      const oldest = this.#clips.keys().next().value;
      this.#clips.delete(oldest);
    }
    return id;
  }

  /** Read a stored clip. */
  get(id) {
    return this.#clips.get(id);
  }
}

/** Normalize model-provided summary text into one bounded spoken sentence run. */
function normalizeSummary(value) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (text.length <= MAX_SUMMARY_CHARS) return text;
  const cut = text.slice(0, MAX_SUMMARY_CHARS);
  const boundary = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf(', '), cut.lastIndexOf(' '));
  return (boundary > 40 ? cut.slice(0, boundary + 1) : cut).trim();
}

/**
 * Voice-replies feature state: the enabled flag and the chosen voice, the
 * on-demand synthesizer, and the clip store the route serves from.
 */
class VoiceReplies {
  #directory;
  #assets;
  #worker = new TtsWorker();
  #clips = new ClipStore();
  #state = { enabled: false, voice: DEFAULT_VOICE, intonation: DEFAULT_INTONATION, rate: DEFAULT_RATE };
  #stateFile;
  #loadTask;
  #preparing;
  #pronunciations = { at: 0, replace: (text) => text };
  #error = '';

  constructor(directory) {
    this.#directory = directory;
    this.#assets = new Assets(directory);
    this.#stateFile = path.join(directory, 'state.json');
    this.#loadTask = this.#load();
  }

  async #load() {
    try {
      const parsed = JSON.parse(await fsp.readFile(this.#stateFile, 'utf8'));
      this.#state = {
        enabled: parsed?.enabled === true,
        voice: VOICE_BY_ID.has(parsed?.voice) ? parsed.voice : DEFAULT_VOICE,
        intonation: typeof parsed?.intonation === 'string' && parsed.intonation in INTONATIONS ? parsed.intonation : DEFAULT_INTONATION,
        rate: typeof parsed?.rate === 'string' && parsed.rate in RATES ? parsed.rate : DEFAULT_RATE,
      };
    } catch {
      this.#state = { enabled: false, voice: DEFAULT_VOICE, intonation: DEFAULT_INTONATION, rate: DEFAULT_RATE };
    }
  }

  /** Wait for the persisted selection to load. */
  async settle() {
    await this.#loadTask;
  }

  /** Whether voice replies are currently enabled. */
  get enabled() {
    return this.#state.enabled;
  }

  /** The selected voice id. */
  get voice() {
    return this.#state.voice;
  }

  /** Public state for the browser half. */
  snapshot() {
    return {
      enabled: this.#state.enabled,
      voice: this.#state.voice,
      intonation: this.#state.intonation,
      rate: this.#state.rate,
      intonations: Object.keys(INTONATIONS),
      rates: Object.keys(RATES),
      voices: VOICES.map((voice) => ({
        id: voice.id,
        title: voice.title,
        ready: this.#assets.ready(voice.id),
        bytes: voice.bytes + voice.tokensBytes,
      })),
      preparing: this.#preparing !== undefined,
      error: this.#error,
    };
  }

  /** Apply a browser-driven preference patch and persist it. */
  async configure(patch) {
    await this.settle();
    if (typeof patch?.voice === 'string') {
      if (!VOICE_BY_ID.has(patch.voice)) throw new Error(`unknown voice: ${patch.voice}`);
      this.#state.voice = patch.voice;
    }
    if (typeof patch?.enabled === 'boolean') this.#state.enabled = patch.enabled;
    if (typeof patch?.intonation === 'string') {
      if (!(patch.intonation in INTONATIONS)) throw new Error(`unknown intonation: ${patch.intonation}`);
      this.#state.intonation = patch.intonation;
    }
    if (typeof patch?.rate === 'string') {
      if (!(patch.rate in RATES)) throw new Error(`unknown rate: ${patch.rate}`);
      this.#state.rate = patch.rate;
    }
    await fsp.mkdir(this.#directory, { recursive: true });
    await fsp.writeFile(this.#stateFile, JSON.stringify(this.#state));
    this.#error = '';
    if (this.#state.enabled) this.#prepareInBackground(this.#state.voice);
    return this.snapshot();
  }

  /** Kick asset preparation without awaiting it. */
  #prepareInBackground(voiceId) {
    if (this.#preparing !== undefined) return;
    this.#preparing = this.#assets.prepare(voiceId, new AbortController().signal)
      .catch((error) => {
        this.#error = messageOf(error);
      })
      .finally(() => {
        this.#preparing = undefined;
      });
  }

  /**
   * The current pronunciation replacer, reloaded when the JSON file changes.
   * @returns the whole-word replacer to apply before synthesis.
   */
  async #pronunciationReplacer() {
    const file = path.join(this.#directory, PRONUNCIATIONS_FILE);
    try {
      const info = await fsp.stat(file);
      if (info.mtimeMs !== this.#pronunciations.at) {
        const table = JSON.parse(await fsp.readFile(file, 'utf8'));
        this.#pronunciations = { at: info.mtimeMs, replace: compilePronunciations(table) };
      }
    } catch {
      if (this.#pronunciations.at !== 0) this.#pronunciations = { at: 0, replace: (text) => text };
    }
    return this.#pronunciations.replace;
  }

  /** Synthesize one summary for the selected voice and store the clip. */
  async speak(text, signal) {
    await this.settle();
    const voice = VOICE_BY_ID.get(this.#state.voice) ?? VOICE_BY_ID.get(DEFAULT_VOICE);
    this.#prepareInBackground(voice.id);
    await this.#assets.prepare(voice.id, signal);
    const paths = voicePaths(this.#directory, voice);
    const intonation = INTONATIONS[this.#state.intonation] ?? INTONATIONS[DEFAULT_INTONATION];
    const replace = await this.#pronunciationReplacer();
    const spokenText = replace(text);
    const rendered = await this.#worker.synthesize({
      text: spokenText,
      voice: voice.id,
      model: paths.model,
      tokens: paths.tokens,
      dataDir: path.join(this.#directory, 'espeak-ng-data'),
      noiseScale: intonation.noiseScale,
      noiseScaleW: intonation.noiseScaleW,
      speed: RATES[this.#state.rate] ?? RATES[DEFAULT_RATE],
    }, signal);
    const wav = encodeWav(rendered.samples, rendered.sampleRate);
    const seconds = rendered.samples.length / rendered.sampleRate;
    const audioId = this.#clips.put(spokenText, voice.id, wav, seconds);
    return { audioId, seconds, voice: voice.id };
  }

  /** One stored clip, if it is still cached. */
  clip(id) {
    return this.#clips.get(id);
  }

  /** Release the synthesis worker. */
  async dispose() {
    await this.#worker.stop();
  }
}

/**
 * Register the voice-replies feature: the speak_summary Tool, the conditional
 * system-prompt section, and the authenticated route the browser half uses.
 * @param ctx - Host context with Connection, Tools, and the system prompt.
 */
export function apply(ctx) {
  const directory = path.join(hostHome(), 'tts-ru');
  const replies = new VoiceReplies(directory);
  const route = async (request) => {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    try {
      await replies.settle();
      if (body?.action === 'state') return Response.json(replies.snapshot());
      if (body?.action === 'config') return Response.json(await replies.configure(body));
      if (body?.action === 'audio') {
        const clip = replies.clip(String(body.id ?? ''));
        if (clip === undefined) return Response.json({ message: 'this clip is no longer cached' }, { status: 404 });
        return new Response(clip.wav, { headers: { 'content-type': 'audio/wav', 'cache-control': 'no-store' } });
      }
      return Response.json({ message: 'unknown action' }, { status: 400 });
    } catch (error) {
      return Response.json({ message: messageOf(error) }, { status: 503 });
    }
  };

  ctx.effect(() => ctx.connection.fetch.register({
    path: ROUTE_PATH,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: route,
  }), 'tts-ru: route');

  ctx.effect(() => ctx.tools.register({
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    // ToolSchema.parameters is a complete JSON Schema for the arguments: the model
    // API rejects anything that is not an object-rooted schema.
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Spoken line in the user\'s language: at most 400 characters, plain prose without markdown or code. For an intro, one sentence naming the task; for a summary, 2-3 sentences with the takeaway.',
        },
        kind: {
          type: 'string',
          enum: ['intro', 'progress', 'summary'],
          description: 'Use "intro" for the one-sentence announcement right before a work phase that uses tools, "progress" for a one-sentence milestone during the work, and "summary" for the closing takeaway after an answer.',
        },
      },
      required: ['text'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{
        type: 'text',
        text: value?.spoken === true
          ? `${value.kind === 'intro' ? 'voice intro' : value.kind === 'progress' ? 'voice progress' : 'voice summary'} prepared: ${value.seconds}s, voice ${value.voice}`
          : `voice summary skipped: ${String(value?.reason ?? 'unavailable')}`,
      }],
      presentationMeta: (args, value) => (value?.spoken === true
        ? { audioId: value.audioId, seconds: value.seconds, text: normalizeSummary(args?.text).slice(0, 240), voice: value.voice, kind: value.kind }
        : undefined),
    },
    execute: async (args, exec) => {
      await replies.settle();
      if (!replies.enabled) return { spoken: false, reason: 'voice replies are disabled' };
      const text = normalizeSummary(args?.text);
      if (text === '') return { spoken: false, reason: 'the spoken summary was empty' };
      const kind = args?.kind === 'intro' ? 'intro' : args?.kind === 'progress' ? 'progress' : 'summary';
      const result = await replies.speak(text, exec.signal);
      return { spoken: true, audioId: result.audioId, seconds: Math.round(result.seconds * 10) / 10, voice: result.voice, kind };
    },
  }), 'tts-ru: speak_summary tool');

  ctx.effect(() => ctx.systemPrompt.section({
    name: PROMPT_SECTION,
    order: ctx.systemPrompt.getSectionOrder('TOOL_REPORT') + 10,
    text: () => {
      if (!replies.enabled) return '';
      const voice = VOICE_BY_ID.get(replies.voice) ?? VOICE_BY_ID.get(DEFAULT_VOICE);
      return `${VOICE_PROMPT}\n${genderPrompt(voice)}`;
    },
  }), 'tts-ru: voice prompt section');

  ctx.effect(() => () => replies.dispose(), 'tts-ru: synthesis worker');
}

/** Connection serves the route; Tools and the system prompt carry the model surface. */
export const inject = ['connection', 'tools', 'systemPrompt'];
