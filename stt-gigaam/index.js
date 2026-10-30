/**
 * Host half of the GigaAM Russian speech provider bundle.
 *
 * DSH voice input routes a recorded WAV through `ctx.speechToText`. The shipped
 * provider (SenseVoiceSmall) covers zh/en/yue/ja/ko only, so this bundle
 * contributes a second, fully local provider for Russian: Sber's GigaAM v3 CTC
 * model exported to ONNX and executed by sherpa-onnx on the Host CPU.
 *
 * The model is not part of the package: preparation downloads it once into the
 * DSH home, verifies its size, and then loads it in a worker thread. Audio
 * never leaves the machine and is never written to a Session log.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';

/** Registration identity of the provider. */
const PROVIDER_ID = 'gigaam-local';
/** Hugging Face repository path and pinned revision of the converted GigaAM v3 CTC model. */
const MODEL_NAMESPACE = 'csukuangfj/sherpa-onnx-nemo-ctc-giga-am-v3-russian-2025-12-16';
const MODEL_REVISION = '32a4c7cc81809bd132e2d935ab99e9e6ab47fbec';
/** Download origins, tried in order unless one is selected explicitly. */
const ORIGINS = ['https://huggingface.co', 'https://hf-mirror.com'];
/** Prepared assets and their exact byte sizes. */
const MODEL_FILE = 'model.int8.onnx';
const MODEL_BYTES = 224_721_476;
const MODEL_SHA256 = 'f86ebfa0429ced91be6054fc344827e9c6c2572f3c318416cd974b06f66437ec';
const TOKENS_FILE = 'tokens.txt';
const TOKENS_BYTES = 196;
/** Canonical recording format the voice pipeline hands to providers. */
const SAMPLE_RATE = 16_000;
/** Inference threads inside the worker. */
const NUM_THREADS = 4;

/** Narrow an unknown thrown value to a readable message. */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/** Create an AbortError-compatible rejection for cancellation paths. */
function abortError() {
  const error = new Error('speech recognition was cancelled');
  error.name = 'AbortError';
  return error;
}

/** The durable directory that owns prepared model assets. */
function resolveDirectory(config) {
  const configured = typeof config?.dataRoot === 'string' && config.dataRoot.length > 0 ? config.dataRoot : undefined;
  if (configured !== undefined) return path.resolve(configured);
  const home = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.length > 0 ? process.env.DSH_HOME : path.join(os.homedir(), '.dsh');
  return path.join(home, 'speech-to-text-gigaam');
}

/** The configured download origins, most preferred first. */
function resolveOrigins(config) {
  const configured = Array.isArray(config?.modelOrigins) ? config.modelOrigins : undefined;
  const origins = (configured ?? ORIGINS).filter((origin) => typeof origin === 'string' && /^https?:\/\//.test(origin));
  return origins.length > 0 ? origins : [...ORIGINS];
}

/** Absolute download URL of one pinned asset on one origin. */
function assetUrl(origin, file) {
  return `${origin.replace(/\/$/, '')}/${MODEL_NAMESPACE}/resolve/${MODEL_REVISION}/${file}`;
}

/**
 * Parse a canonical 16 kHz mono PCM16 WAV into float samples.
 * @param bytes - complete WAV file handed over by the voice pipeline.
 * @returns mono samples in [-1, 1].
 */
function decodeWav(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 44) throw new Error('GigaAM received an invalid WAV recording');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset) => String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('GigaAM received a file that is not a WAV recording');
  let offset = 12;
  let format;
  let data;
  while (offset + 8 <= view.byteLength) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ' && body + 16 <= view.byteLength) {
      format = {
        encoding: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
      };
    } else if (id === 'data') {
      data = { start: body, size: Math.min(size, view.byteLength - body) };
    }
    offset = body + size + (size % 2);
    if (format !== undefined && data !== undefined) break;
  }
  if (format === undefined || data === undefined) throw new Error('GigaAM received a WAV recording without format or sample data');
  if (format.encoding !== 1 || format.channels !== 1 || format.bits !== 16 || format.sampleRate !== SAMPLE_RATE) {
    throw new Error(`GigaAM expects 16 kHz mono PCM16 audio, received ${format.sampleRate} Hz / ${format.channels} channel(s) / ${format.bits}-bit / encoding ${format.encoding}`);
  }
  const count = Math.floor(data.size / 2);
  const samples = new Float32Array(count);
  for (let index = 0; index < count; index += 1) samples[index] = view.getInt16(data.start + index * 2, true) / 0x8000;
  return samples;
}

/** SHA-256 hex digest of one file, streaming so large models stay out of memory. */
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

/**
 * Worker-thread owner of the native recognizer. Loading and inference happen in
 * the worker, so the Host event loop stays responsive and an aborted recording
 * can terminate the worker instead of waiting for inference to finish.
 */
class GigaamWorker {
  #directory;
  #worker;
  #ready;
  #pending = new Map();
  #nextId = 1;

  constructor(directory) {
    this.#directory = directory;
  }

  /** Whether a worker is currently loaded and ready. */
  get loaded() {
    return this.#worker !== undefined;
  }

  /** Start (or reuse) the inference worker and resolve once the model is loaded. */
  async start() {
    if (this.#worker !== undefined) return;
    const worker = new Worker(new URL('./worker.js', import.meta.url), { name: 'gigaam-asr' });
    this.#worker = worker;
    let settleReady;
    let settleFailed;
    this.#ready = new Promise((resolve, reject) => {
      settleReady = resolve;
      settleFailed = reject;
    });
    worker.on('message', (message) => this.#onMessage(message, settleReady, settleFailed));
    worker.on('error', (error) => this.#fail(new Error(`GigaAM worker failed: ${messageOf(error)}`)));
    worker.on('exit', (code) => this.#fail(new Error(`GigaAM worker exited with code ${code}`)));
    worker.postMessage({
      type: 'init',
      model: path.join(this.#directory, MODEL_FILE),
      tokens: path.join(this.#directory, TOKENS_FILE),
      numThreads: NUM_THREADS,
    });
    try {
      await this.#ready;
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  #onMessage(message, settleReady, settleFailed) {
    if (message?.type === 'ready') {
      settleReady();
      return;
    }
    if (message?.type === 'init-error') {
      settleFailed(new Error(`GigaAM could not load the model: ${message.message}`));
      return;
    }
    if (message?.type !== 'result' && message?.type !== 'error') return;
    const pending = this.#pending.get(message.id);
    if (pending === undefined) return;
    this.#pending.delete(message.id);
    pending.signal?.removeEventListener('abort', pending.onAbort);
    if (message.type === 'result') pending.resolve({ text: typeof message.text === 'string' ? message.text : '', inferenceSeconds: Number(message.inferenceSeconds) || 0 });
    else pending.reject(new Error(message.message ?? 'GigaAM transcription failed'));
  }

  #fail(error) {
    for (const pending of this.#pending.values()) {
      pending.signal?.removeEventListener('abort', pending.onAbort);
      pending.reject(error);
    }
    this.#pending.clear();
    this.#worker = undefined;
    this.#ready = undefined;
  }

  /** Transcribe one decoded recording; aborting terminates the worker. */
  async transcribe(samples, signal) {
    if (this.#worker === undefined) throw new Error('the GigaAM recognizer is not prepared');
    const id = this.#nextId;
    this.#nextId += 1;
    const worker = this.#worker;
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
      worker.postMessage({ type: 'transcribe', id, samples, sampleRate: SAMPLE_RATE }, [samples.buffer]);
    });
  }

  /** Terminate the worker; the next transcribe starts a fresh one. */
  async stop() {
    const worker = this.#worker;
    this.#worker = undefined;
    this.#ready = undefined;
    for (const pending of this.#pending.values()) {
      pending.signal?.removeEventListener('abort', pending.onAbort);
      pending.reject(new Error('GigaAM worker stopped'));
    }
    this.#pending.clear();
    if (worker !== undefined) await worker.terminate().catch(() => {});
  }
}

/**
 * Host-owned preparation of the model assets plus provider readiness. Mirrors
 * the states the voice UI renders: check, download, verify, load.
 */
class GigaamPreparation {
  #directory;
  #worker;
  #origins;
  #listeners = new Set();
  #state = Object.freeze({ phase: 'unprepared' });
  #task;
  #controller;

  constructor(directory, worker, origins) {
    this.#directory = directory;
    this.#worker = worker;
    this.#origins = origins;
  }

  snapshot() {
    return this.#state;
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #publish(state) {
    this.#state = Object.freeze(state);
    for (const listener of [...this.#listeners]) {
      try {
        listener();
      } catch {
        // A failing observer must not break preparation.
      }
    }
  }

  #steps(status) {
    const base = [
      { kind: 'check', status: status === 'pending' ? 'pending' : 'complete' },
      { kind: 'model', status: 'pending' },
      { kind: 'verify', status: 'pending' },
      { kind: 'load', status: 'pending' },
    ];
    return Object.freeze(base.map((step) => Object.freeze(step)));
  }

  /** Start or join the current preparation task. */
  prepare(options = {}) {
    if (this.#task !== undefined) return;
    const selected = typeof options?.downloadSource === 'string' ? options.downloadSource : undefined;
    if (selected !== undefined && !this.#origins.includes(selected)) {
      this.#publish({ phase: 'failed', message: `the download source ${JSON.stringify(selected)} is not offered by this provider` });
      return;
    }
    const controller = new AbortController();
    this.#controller = controller;
    this.#task = this.#run(controller.signal, selected)
      .catch(() => {})
      .finally(() => {
        if (this.#controller === controller) this.#controller = undefined;
        this.#task = undefined;
      });
  }

  /** Cancel preparation and wait for the task to settle. */
  async cancel() {
    this.#controller?.abort();
    await this.#task;
  }

  /** Release preparation state; the provider owns the worker separately. */
  async dispose() {
    await this.cancel();
  }

  /** Replace one step's status in the published step list. */
  #stepStates(step, status) {
    return undefined;
  }

  async #run(signal, selected) {
    const startedAt = Date.now();
    try {
      this.#publish({ phase: 'checking', startedAt, step: 'check', steps: this.#steps('running') });
      const complete = await this.#assetsComplete();
      if (complete) {
        await this.#worker.start();
        this.#publish({ phase: 'ready' });
        return;
      }
      await fsp.mkdir(this.#directory, { recursive: true });
      const origins = selected === undefined ? this.#origins : [selected];
      await this.#downloadWithProgress(MODEL_FILE, MODEL_BYTES, signal, origins, 'model');
      await this.#downloadWithProgress(TOKENS_FILE, TOKENS_BYTES, signal, origins, 'model');
      this.#publish({ phase: 'checking', startedAt: Date.now(), step: 'verify', steps: this.#steps('running') });
      await this.#verify(MODEL_FILE, MODEL_BYTES);
      await this.#verify(TOKENS_FILE, TOKENS_BYTES);
      this.#publish({ phase: 'loading', startedAt: Date.now(), step: 'load', steps: this.#steps('running') });
      await this.#worker.start();
      this.#publish({ phase: 'ready' });
    } catch (error) {
      if (signal.aborted) {
        this.#publish({ phase: 'cancelled' });
        return;
      }
      this.#publish({ phase: 'failed', message: messageOf(error) });
    }
  }

  /** Whether both pinned assets already exist with the expected sizes. */
  async #assetsComplete() {
    try {
      const [model, tokens] = await Promise.all([
        fsp.stat(path.join(this.#directory, MODEL_FILE)),
        fsp.stat(path.join(this.#directory, TOKENS_FILE)),
      ]);
      return model.isFile() && model.size === MODEL_BYTES && tokens.isFile() && tokens.size === TOKENS_BYTES;
    } catch {
      return false;
    }
  }

  async #verify(file, bytes) {
    const target = path.join(this.#directory, file);
    const stat = await fsp.stat(target).catch(() => undefined);
    if (stat === undefined || !stat.isFile() || stat.size !== bytes) throw new Error(`${file} is missing or truncated; remove ${this.#directory} and prepare again`);
    if (file === MODEL_FILE && MODEL_SHA256.length > 0) {
      const digest = await sha256Of(target);
      if (digest !== MODEL_SHA256) throw new Error(`${file} failed its integrity check; remove ${this.#directory} and prepare again`);
    }
  }

  async #downloadWithProgress(file, bytes, signal, origins, step) {
    const target = path.join(this.#directory, file);
    const partial = `${target}.partial`;
    let lastError;
    for (const origin of origins) {
      try {
        await this.#download(origin, file, partial, bytes, signal, step);
        await fsp.rename(partial, target);
        return;
      } catch (error) {
        if (signal.aborted) throw error;
        lastError = error;
        await fsp.rm(partial, { force: true }).catch(() => {});
      }
    }
    throw lastError ?? new Error(`could not download ${file}`);
  }

  async #download(origin, file, partial, bytes, signal, step) {
    const response = await fetch(assetUrl(origin, file), { signal, redirect: 'follow' });
    if (!response.ok || response.body === null) throw new Error(`HTTP ${response.status} while downloading ${file} from ${origin}`);
    const handle = await fsp.open(partial, 'w');
    let received = 0;
    try {
      for await (const chunk of response.body) {
        if (signal.aborted) throw abortError();
        await handle.write(chunk);
        received += chunk.length;
        this.#publish({ phase: 'downloading', resource: file, completedBytes: received, totalBytes: bytes, step });
      }
    } finally {
      await handle.close();
    }
    if (received !== bytes) throw new Error(`${file} download ended at ${received} of ${bytes} bytes`);
  }
}

/**
 * Register the GigaAM provider for one Host composition.
 * @param ctx - Host context carrying the speech registry.
 * @param config - loader row config: `dataRoot` and `modelOrigins` overrides.
 */
export function apply(ctx, config = {}) {
  const directory = resolveDirectory(config);
  const worker = new GigaamWorker(directory);
  const preparation = new GigaamPreparation(directory, worker, resolveOrigins(config));
  const info = {
    id: PROVIDER_ID,
    name: 'GigaAM v3 (Russian, local)',
    location: 'host-local',
    // 'auto' is accepted because the shared preference defaults to it and the
    // language picker only offers the selected provider's hints; without it the
    // first switch to this provider is rejected. The model is Russian-only, so
    // every accepted hint produces Russian text.
    languages: ['auto', 'ru'],
    downloadSources: resolveOrigins(config),
    setupEstimate: {
      recommendedDiskBytes: MODEL_BYTES + TOKENS_BYTES,
      expectedMemoryBytes: 1_100_000_000,
      minimumMinutes: 1,
      maximumMinutes: 10,
    },
  };
  ctx.effect(() => {
    const unregister = ctx.speechToText.register({
      info,
      preparation,
      transcribe: async (input, signal) => {
        if (preparation.snapshot().phase !== 'ready' && !worker.loaded) {
          throw new Error('the GigaAM model is not prepared yet: open the voice input settings and press Prepare');
        }
        const samples = decodeWav(input.audio);
        // Read the duration before the samples travel to the worker: the transfer
        // detaches the buffer on this side.
        const audioSeconds = samples.length / SAMPLE_RATE;
        await worker.start().catch((error) => {
          throw new Error(`the GigaAM model could not be loaded: ${messageOf(error)}`);
        });
        const result = await worker.transcribe(samples, signal);
        return { text: result.text.trim(), audioSeconds, inferenceSeconds: result.inferenceSeconds };
      },
    });
    return async () => {
      const removing = unregister();
      await preparation.dispose();
      await worker.stop();
      await removing;
    };
  }, 'stt-gigaam: provider');
}

/** The speech registry is the only hard dependency; the provider idles until voice input mounts it. */
export const inject = ['speechToText'];
