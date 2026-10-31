/**
 * Host half of the local voice assistant.
 *
 * The browser half keeps a microphone conversation with the model; this half
 * owns everything the browser cannot do itself: it registers the
 * `assistant_say` Tool the model calls to speak a line, synthesizes that line
 * locally with a Piper Russian voice (sherpa-onnx in a worker thread), keeps the
 * rendered WAV in memory, and serves it over one authenticated Connection
 * route. It also persists the mode/voice/intonation/rate selection and, while
 * the mode is enabled, injects the system-prompt section that tells the model
 * how to narrate its work out loud.
 *
 * Voice assets are shared with the `tts-ru` plugin: the ready Piper voices and
 * the extracted espeak-ng phoneme data under `$DSH_HOME/tts-ru` are reused as
 * they are, and only a missing voice is downloaded, into
 * `$DSH_HOME/voice-assistant`.
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { applyProvider as applyGigaamProvider, GigaamService } from './gigaam.js';

const require = createRequire(import.meta.url);
const seekBzip = require('seek-bzip');

/** Tool name the model calls; the browser half keys its tool view by it. */
const TOOL_NAME = 'assistant_say';
/** Authenticated Connection route shared by the browser half. */
const ROUTE_PATH = '/api/voice-assistant';
/** Prompt section that advertises the enabled mode to the model. */
const PROMPT_SECTION = 'voice-assistant:mode';
/** Directory (under the DSH home) that owns this plugin's state and downloads. */
const STATE_DIRECTORY = 'voice-assistant';
/** Sibling plugin directory whose ready assets are reused instead of downloaded. */
const SHARED_ASSET_DIRECTORY = 'tts-ru';
/** Longest spoken line accepted from the model. */
const MAX_LINE_CHARS = 600;
/** Cap on in-memory rendered clips; the oldest clip leaves first. */
const MAX_CLIPS = 32;

/** English Piper voice offered next to the Russian voices in the picker. */
const ENGLISH_VOICE = Object.freeze({
  id: 'en-lessac',
  title: 'English (Lessac)',
  gender: 'female',
  lang: 'en',
  repo: 'csukuangfj/vits-piper-en_US-lessac-medium',
  revision: '83f7470750b36549037551ef7007fa3b4b8697e0',
  file: 'en_US-lessac-medium.onnx',
  bytes: 63_201_425,
  tokensBytes: 921,
});

/** Russian piper voices converted for sherpa-onnx, pinned by revision. */
const VOICES = Object.freeze([
  { id: 'irina', title: 'Ирина (женский)', gender: 'female', repo: 'csukuangfj/vits-piper-ru_RU-irina-medium', revision: 'b095bed45c39813266edf14ffa2bade5ebfc929c', file: 'ru_RU-irina-medium.onnx', bytes: 63_201_422, tokensBytes: 899 },
  { id: 'dmitri', title: 'Дмитрий (мужской)', gender: 'male', repo: 'csukuangfj/vits-piper-ru_RU-dmitri-medium', revision: '51cc3e9ea521e33ef3771f11e02b29ecb42a91f1', file: 'ru_RU-dmitri-medium.onnx', bytes: 63_201_422, tokensBytes: 907 },
  { id: 'denis', title: 'Денис (мужской)', gender: 'male', repo: 'csukuangfj/vits-piper-ru_RU-denis-medium', revision: '1e2f78fc13100abc60bf56264dc2ee254b4c5f8e', file: 'ru_RU-denis-medium.onnx', bytes: 63_201_422, tokensBytes: 907 },
  { id: 'ruslan', title: 'Руслан (мужской)', gender: 'male', repo: 'csukuangfj/vits-piper-ru_RU-ruslan-medium', revision: '22c226825c24319e30cbf8a3844a240b9f6b1951', file: 'ru_RU-ruslan-medium.onnx', bytes: 63_201_422, tokensBytes: 921 },
  ENGLISH_VOICE,
]);
const VOICE_BY_ID = new Map(VOICES.map((voice) => [voice.id, voice]));
/** Default voice used until the person picks another one. */
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
/**
 * How the microphone is armed. `push` records only while the talk control is
 * held, so a movie or a conversation in the room cannot inject stray prompts;
 * `continuous` keeps the VAD listening for hands-free barge-in.
 */
const LISTEN_MODES = Object.freeze(['push', 'continuous']);
/** Listening mode used until the person picks another one. */
const DEFAULT_LISTEN_MODE = 'push';
/** VAD sensitivity presets for continuous mode. */
const VAD_SENSITIVITIES = Object.freeze(['low', 'normal', 'high']);
/** Sensitivity used until the person picks another one. */
const DEFAULT_VAD_SENSITIVITY = 'normal';
/** espeak-ng phoneme data required by the phoneme-based Piper voices. */
const ESPEAK = Object.freeze({
  url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/espeak-ng-data.tar.bz2',
  bytes: 7_252_012,
  sha256: '4135ccf82e1f40613491c0874d4945ae9e9c7840933d8e25a6f9e003d9ebf533',
});
/** Model download origins, tried in order. */
const ORIGINS = ['https://huggingface.co', 'https://hf-mirror.com'];

/** Instruction injected into the system prompt while voice-assistant mode is on. */
const VOICE_PROMPT = `Voice assistant mode is enabled: the user talks to you by microphone and hears
your lines spoken through the \`assistant_say\` tool.
Narrate what you do: before a work phase that will use tools call
\`assistant_say\` once with kind "intro" and one short spoken sentence naming the
task; while working call it at meaningful milestones with kind "progress" (a few
per task, never repeat a line).
Always finish the turn with exactly one \`assistant_say\` call with kind "reply":
the complete conversational answer the user hears, 1-4 short sentences of
natural spoken Russian, plain prose (no markdown, no code, no lists). The written
answer can stay concise; the spoken reply is what the user relies on.
Keep every spoken line short; never read out file paths, code or tool names.
Speak in the language of the selected voice (Russian voices read Russian, English voices read English); do not mix the two on purpose.`;

/**
 * Keep every first-person reference in the grammatical gender of the selected
 * voice, so a female voice never says "я нашёл" and a male voice never says
 * "я нашла".
 * @param voice - the selected voice descriptor from {@link VOICES}.
 */
function genderPrompt(voice) {
  const title = voice?.title ?? 'Ирина (женский)';
  if (voice?.gender === 'male') {
    return `The selected voice is ${title}. In gendered languages refer to yourself in masculine grammatical forms in the written answer and in every spoken line: "я проверил", "я нашёл", "я готов", "сделал" — never "я проверила", "нашла", "готова".`;
  }
  return `The selected voice is ${title}. In gendered languages refer to yourself in feminine grammatical forms in the written answer and in every spoken line: "я проверила", "я нашла", "я готова", "сделала" — never "я проверил", "нашёл", "готов".`;
}

/** Tool description shown to the model. */
const TOOL_DESCRIPTION = `Send one short spoken line for local text-to-speech playback (at most 600 characters).
Used while voice-assistant mode is enabled: pass kind "intro" with a one-sentence announcement of a work phase that will use tools, kind "progress" with one sentence about a meaningful milestone while the work runs, and kind "reply" with the complete conversational answer the user hears at the end of the turn (1-4 short sentences of natural spoken Russian). Write plain prose without markdown, code, lists or tool names. The line is synthesized on this machine and played in the browser; it is not the written answer itself.`;

/** Narrow an unknown thrown value to a readable message. */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/** Create an AbortError-compatible rejection for cancellation paths. */
function abortError() {
  const error = new Error('the voice assistant line was cancelled');
  error.name = 'AbortError';
  return error;
}

/** The DSH home that owns durable state for this installation. */
function hostHome() {
  const configured = process.env.DSH_HOME;
  if (typeof configured === 'string' && configured.length > 0) return configured;
  return path.join(os.homedir(), '.dsh');
}

/** Resolve one voice's absolute asset paths inside one asset directory. */
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

  /** Synthesize one text through the worker, restarting it when needed. */
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
    const worker = new Worker(new URL('./worker.js', import.meta.url), { name: 'voice-assistant-piper' });
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

/**
 * Owns voice assets shared with the `tts-ru` plugin: each asset (the espeak-ng
 * data, one voice model) is looked up in this plugin's own directory first and
 * then in the sibling one, and anything still missing is downloaded here.
 */
class Assets {
  #directory;
  #shared;
  #task;
  #taskVoice;

  constructor(directory, shared) {
    this.#directory = directory;
    this.#shared = shared;
  }

  /** Directories probed for ready assets, most specific first. */
  #candidates() {
    return this.#directory === this.#shared ? [this.#directory] : [this.#directory, this.#shared];
  }

  /** The directory that already holds the espeak-ng phoneme data, if any. */
  espeakDirectory() {
    for (const directory of this.#candidates()) {
      if (espeakReady(directory)) return directory;
    }
    return undefined;
  }

  /** The directory that already holds one complete voice, if any. */
  voiceDirectory(voice) {
    for (const directory of this.#candidates()) {
      if (voiceReady(directory, voice)) return directory;
    }
    return undefined;
  }

  /** Whether the espeak-ng phoneme data and the requested voice are complete. */
  ready(voiceId) {
    const voice = VOICE_BY_ID.get(voiceId);
    return voice !== undefined && this.espeakDirectory() !== undefined && this.voiceDirectory(voice) !== undefined;
  }

  /**
   * Absolute paths the engine needs for one voice. Only valid after
   * {@link ready}; the model/tokens may live in a different directory than the
   * espeak-ng data when the sibling plugin already had one of them.
   */
  layout(voiceId) {
    const voice = VOICE_BY_ID.get(voiceId);
    if (voice === undefined) throw new Error(`unknown voice: ${voiceId}`);
    const directory = this.voiceDirectory(voice);
    if (directory === undefined) throw new Error(`the ${voice.id} voice is not downloaded yet`);
    const dataDirectory = this.espeakDirectory();
    if (dataDirectory === undefined) throw new Error('the espeak-ng phoneme data is not downloaded yet');
    const paths = voicePaths(directory, voice);
    return { model: paths.model, tokens: paths.tokens, dataDir: path.join(dataDirectory, 'espeak-ng-data') };
  }

  /**
   * Start (or join) asset preparation for one voice. A request for a different
   * voice waits for the running one instead of being handed its result.
   */
  prepare(voiceId, signal) {
    const running = this.#task;
    if (running !== undefined && this.#taskVoice === voiceId) return running;
    const run = (running === undefined ? Promise.resolve() : running.catch(() => {}))
      .then(() => this.#run(voiceId, signal))
      .finally(() => {
        if (this.#task === run) {
          this.#task = undefined;
          this.#taskVoice = undefined;
        }
      });
    this.#task = run;
    this.#taskVoice = voiceId;
    return run;
  }

  async #run(voiceId, signal) {
    const voice = VOICE_BY_ID.get(voiceId);
    if (voice === undefined) throw new Error(`unknown voice: ${voiceId}`);
    await fsp.mkdir(path.join(this.#directory, 'voices'), { recursive: true });
    if (this.espeakDirectory() === undefined) {
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
    if (this.voiceDirectory(voice) === undefined) {
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

  /** Store one clip under the hash of its settings and text, returning the id. */
  put(key, wav, seconds, text) {
    const id = createHash('sha256').update(key).digest('hex').slice(0, 20);
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

/** Normalize model-provided text into one bounded spoken sentence run. */
function normalizeLine(value) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (text.length <= MAX_LINE_CHARS) return text;
  const cut = text.slice(0, MAX_LINE_CHARS);
  const boundary = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf(', '), cut.lastIndexOf(' '));
  return (boundary > 40 ? cut.slice(0, boundary + 1) : cut).trim();
}

/** Coerce a spoken-line kind to the three accepted values, defaulting to reply. */
function normalizeKind(value) {
  return value === 'intro' || value === 'progress' ? value : 'reply';
}

/** Round a clip duration to the tenth of a second shown in the UI. */
function roundSeconds(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Voice-assistant mode state: the enabled flag and the spoken-voice presets,
 * the on-demand synthesizer, and the clip store the route serves from.
 */
class VoiceAssistant {
  #directory;
  #assets;
  #worker = new TtsWorker();
  #clips = new ClipStore();
  #state = { enabled: false, voice: DEFAULT_VOICE, intonation: DEFAULT_INTONATION, rate: DEFAULT_RATE, listenMode: DEFAULT_LISTEN_MODE, vadSensitivity: DEFAULT_VAD_SENSITIVITY, micDeviceId: '' };
  #stateFile;
  #loadTask;
  #preparing = new Map();
  #error = '';

  constructor(directory, sharedDirectory) {
    this.#directory = directory;
    this.#assets = new Assets(directory, sharedDirectory);
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
        listenMode: LISTEN_MODES.includes(parsed?.listenMode) ? parsed.listenMode : DEFAULT_LISTEN_MODE,
        vadSensitivity: VAD_SENSITIVITIES.includes(parsed?.vadSensitivity) ? parsed.vadSensitivity : DEFAULT_VAD_SENSITIVITY,
        micDeviceId: typeof parsed?.micDeviceId === 'string' ? parsed.micDeviceId : '',
      };
    } catch {
      this.#state = { enabled: false, voice: DEFAULT_VOICE, intonation: DEFAULT_INTONATION, rate: DEFAULT_RATE, listenMode: DEFAULT_LISTEN_MODE, vadSensitivity: DEFAULT_VAD_SENSITIVITY, micDeviceId: '' };
    }
  }

  /** Wait for the persisted selection to load. */
  async settle() {
    await this.#loadTask;
  }

  /** Whether voice-assistant mode is currently enabled. */
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
      listenMode: this.#state.listenMode,
      listenModes: [...LISTEN_MODES],
      vadSensitivity: this.#state.vadSensitivity,
      vadSensitivities: [...VAD_SENSITIVITIES],
      micDeviceId: this.#state.micDeviceId,
      voices: VOICES.map((voice) => ({
        id: voice.id,
        title: voice.title,
        lang: voice.lang ?? 'ru',
        ready: this.#assets.ready(voice.id),
        bytes: voice.bytes + voice.tokensBytes,
      })),
      intonations: Object.keys(INTONATIONS),
      rates: Object.keys(RATES),
      error: this.#error,
      preparing: this.#preparing.size > 0,
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
    if (typeof patch?.listenMode === 'string') {
      if (!LISTEN_MODES.includes(patch.listenMode)) throw new Error(`unknown listen mode: ${patch.listenMode}`);
      this.#state.listenMode = patch.listenMode;
    }
    if (typeof patch?.vadSensitivity === 'string') {
      if (!VAD_SENSITIVITIES.includes(patch.vadSensitivity)) throw new Error(`unknown VAD sensitivity: ${patch.vadSensitivity}`);
      this.#state.vadSensitivity = patch.vadSensitivity;
    }
    if (typeof patch?.micDeviceId === 'string') this.#state.micDeviceId = patch.micDeviceId;
    await fsp.mkdir(this.#directory, { recursive: true });
    await fsp.writeFile(this.#stateFile, JSON.stringify(this.#state));
    this.#error = '';
    if (this.#state.enabled) this.#prepareInBackground(this.#state.voice);
    return this.snapshot();
  }

  /** Prepare the selected voice on request and report the resulting state. */
  prepareSelected() {
    this.#prepareInBackground(this.#state.voice);
    return this.snapshot();
  }

  /** Kick asset preparation for one voice without awaiting it. */
  #prepareInBackground(voiceId) {
    if (this.#preparing.has(voiceId)) return;
    const task = this.#assets.prepare(voiceId, new AbortController().signal)
      .catch((error) => {
        this.#error = messageOf(error);
      })
      .finally(() => {
        this.#preparing.delete(voiceId);
      });
    this.#preparing.set(voiceId, task);
  }

  /** Synthesize one spoken line with the selected voice and store the clip. */
  async speak(text, signal) {
    await this.settle();
    const voice = VOICE_BY_ID.get(this.#state.voice) ?? VOICE_BY_ID.get(DEFAULT_VOICE);
    const intonationId = this.#state.intonation in INTONATIONS ? this.#state.intonation : DEFAULT_INTONATION;
    const rateId = this.#state.rate in RATES ? this.#state.rate : DEFAULT_RATE;
    this.#prepareInBackground(voice.id);
    await this.#assets.prepare(voice.id, signal);
    const paths = this.#assets.layout(voice.id);
    const intonation = INTONATIONS[intonationId];
    const rendered = await this.#worker.synthesize({
      text,
      voice: voice.id,
      model: paths.model,
      tokens: paths.tokens,
      dataDir: paths.dataDir,
      noiseScale: intonation.noiseScale,
      noiseScaleW: intonation.noiseScaleW,
      speed: RATES[rateId],
    }, signal);
    const wav = encodeWav(rendered.samples, rendered.sampleRate);
    const seconds = rendered.samples.length / rendered.sampleRate;
    const audioId = this.#clips.put(`${voice.id}\n${intonationId}\n${rateId}\n${text}`, wav, seconds, text);
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
 * Register the voice-assistant host surface: the `assistant_say` Tool, the
 * conditional system-prompt section, and the authenticated route the browser
 * half uses for state, preferences, synthesis and audio.
 * @param ctx - Host context with Connection, Tools, and the system prompt.
 */
export function apply(ctx) {
  const home = hostHome();
  const directory = path.join(home, STATE_DIRECTORY);
  const shared = path.join(home, SHARED_ASSET_DIRECTORY);
  const assistant = new VoiceAssistant(directory, shared);
  // Recognition is served by this plugin's own route; the official speech
  // registry is only mirrored when it happens to exist, so disabling the
  // built-in voice input or speech-to-text bundles cannot break the assistant.
  const gigaam = new GigaamService();
  applyGigaamProvider(ctx, gigaam);

  const route = async (request) => {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    try {
      await assistant.settle();
      if (body?.action === 'state') return Response.json(assistant.snapshot());
      if (body?.action === 'config') return Response.json(await assistant.configure(body));
      if (body?.action === 'prepare') return Response.json(assistant.prepareSelected());
      if (body?.action === 'transcribe') {
        const audioBase64 = typeof body?.audioBase64 === 'string' ? body.audioBase64 : '';
        if (audioBase64 === '') return Response.json({ message: 'the recording was empty' }, { status: 400 });
        return Response.json(await gigaam.transcribeBase64(audioBase64));
      }
      if (body?.action === 'tts') {
        const text = normalizeLine(body?.text);
        if (text === '') return Response.json({ message: 'the spoken line was empty' }, { status: 400 });
        const kind = normalizeKind(body?.kind);
        const result = await assistant.speak(text);
        return Response.json({ audioId: result.audioId, seconds: roundSeconds(result.seconds), voice: result.voice, kind });
      }
      if (body?.action === 'audio') {
        const clip = assistant.clip(String(body.id ?? ''));
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
  }), 'voice-assistant: route');

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
          description: 'Spoken line in the user\'s language: at most 600 characters, plain prose without markdown, code or tool names. For an intro, one sentence naming the task; for a progress line, one sentence about a milestone; for a reply, 1-4 sentences with the answer the user hears.',
        },
        kind: {
          type: 'string',
          enum: ['intro', 'progress', 'reply'],
          description: 'Use "intro" for the one-sentence announcement right before a work phase that uses tools, "progress" for a one-sentence milestone during the work, and "reply" for the closing spoken answer of the turn.',
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
          ? `voice assistant line prepared: ${value.seconds}s`
          : `voice assistant line skipped: ${String(value?.reason ?? 'unavailable')}`,
      }],
      // The tool-output projector requires a JSON value even when no clip was
      // produced (for example while voice mode is off), so the skipped case
      // returns an empty object instead of undefined.
      presentationMeta: (args, value) => (value?.spoken === true
        ? { audioId: value.audioId, seconds: value.seconds, kind: value.kind, text: normalizeLine(args?.text).slice(0, 240) }
        : {}),
    },
    execute: async (args, exec) => {
      await assistant.settle();
      if (!assistant.enabled) return { spoken: false, reason: 'voice assistant mode is off' };
      const text = normalizeLine(args?.text);
      if (text === '') return { spoken: false, reason: 'the spoken line was empty' };
      const kind = normalizeKind(args?.kind);
      const result = await assistant.speak(text, exec.signal);
      return { spoken: true, audioId: result.audioId, seconds: roundSeconds(result.seconds), kind, voice: result.voice };
    },
  }), 'voice-assistant: assistant_say tool');

  ctx.effect(() => ctx.systemPrompt.section({
    name: PROMPT_SECTION,
    order: ctx.systemPrompt.getSectionOrder('TOOL_REPORT') + 10,
    text: () => {
      if (!assistant.enabled) return '';
      const voice = VOICE_BY_ID.get(assistant.voice) ?? VOICE_BY_ID.get(DEFAULT_VOICE);
      return `${VOICE_PROMPT}\n${genderPrompt(voice)}`;
    },
  }), 'voice-assistant: mode prompt section');

  ctx.effect(() => () => assistant.dispose(), 'voice-assistant: synthesis worker');
  ctx.effect(() => () => gigaam.dispose(), 'voice-assistant: recognition worker');
}

/** Connection serves the route, the tools and prompt carry the model surface, and the speech registry hosts the local recognizer. */
export const inject = ['connection', 'tools', 'systemPrompt'];
