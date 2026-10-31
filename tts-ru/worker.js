/**
 * Piper TTS inference worker: owns the native sherpa-onnx engine so model
 * loading and synthesis never block the Host's event loop.
 *
 * Protocol (structured clone):
 *   in  { type: 'synth', id, text, voice, model, tokens, dataDir, speed }
 *   out { type: 'result', id, samples: Float32Array, sampleRate, inferenceSeconds }
 *   out { type: 'error', id, message }
 */
import { createRequire } from 'node:module';
import { parentPort } from 'node:worker_threads';

const require = createRequire(import.meta.url);

/** Narrow an unknown thrown value to a readable message. */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/** The loaded engine, the voice it belongs to and its prosody settings. */
let engine;

parentPort?.on('message', (message) => {
  if (message?.type !== 'synth') return;
  const started = performance.now();
  try {
    const { OfflineTts } = require('sherpa-onnx-node');
    const noiseScale = Number.isFinite(message.noiseScale) ? message.noiseScale : 0.667;
    const noiseScaleW = Number.isFinite(message.noiseScaleW) ? message.noiseScaleW : 0.8;
    const engineKey = `${message.voice}:${noiseScale}:${noiseScaleW}`;
    if (engine === undefined || engine.key !== engineKey) {
      engine = {
        key: engineKey,
        tts: new OfflineTts({
          model: {
            vits: {
              model: String(message.model),
              tokens: String(message.tokens),
              dataDir: String(message.dataDir),
              // Engine-level prosody: these feed the VITS stochastic duration
              // and pitch predictors, so a preset change rebuilds the engine.
              noiseScale,
              noiseScaleW,
            },
          },
          maxNumSentences: 2,
          numThreads: 2,
          provider: 'cpu',
        }),
      };
    }
    const speed = Number.isFinite(message.speed) ? Math.min(1.4, Math.max(0.6, message.speed)) : 1;
    // Electron's V8 memory cage rejects the sherpa-onnx default external
    // ArrayBuffer for generated samples ("External buffers are not allowed"),
    // so ask the addon to copy the samples into a regular ArrayBuffer instead.
    const audio = engine.tts.generate({ text: String(message.text), sid: 0, speed, enableExternalBuffer: false });
    const samples = audio.samples instanceof Float32Array ? audio.samples : new Float32Array(audio.samples);
    const result = {
      type: 'result',
      id: message.id,
      samples,
      sampleRate: Number(audio.sampleRate) || engine.tts.sampleRate,
      inferenceSeconds: (performance.now() - started) / 1000,
    };
    // The native addon's samples can sit on non-transferable memory, so clone them.
    parentPort.postMessage(result);
  } catch (error) {
    parentPort.postMessage({ type: 'error', id: message.id, message: messageOf(error) });
  }
});
