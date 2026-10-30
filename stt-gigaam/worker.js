/**
 * GigaAM inference worker: owns the native sherpa-onnx recognizer so ONNX
 * inference and model loading never block the Host's event loop.
 *
 * Protocol (structured clone):
 *   in  { type: 'init', model, tokens, numThreads }
 *   out { type: 'ready' } | { type: 'init-error', message }
 *   in  { type: 'transcribe', id, samples: Float32Array, sampleRate }
 *   out { type: 'result', id, text, inferenceSeconds } | { type: 'error', id, message }
 */
import { createRequire } from 'node:module';
import { parentPort } from 'node:worker_threads';

const require = createRequire(import.meta.url);

/** Narrow an unknown thrown value to a readable message. */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

let recognizer;

parentPort?.on('message', (message) => {
  if (message?.type === 'init') {
    try {
      const { OfflineRecognizer } = require('sherpa-onnx-node');
      recognizer = new OfflineRecognizer({
        featConfig: { sampleRate: 16000, featureDim: 80 },
        modelConfig: {
          nemoCtc: { model: String(message.model) },
          tokens: String(message.tokens),
          numThreads: Number.isInteger(message.numThreads) ? message.numThreads : 4,
          provider: 'cpu',
          debug: 0,
        },
      });
      parentPort.postMessage({ type: 'ready' });
    } catch (error) {
      parentPort.postMessage({ type: 'init-error', message: messageOf(error) });
    }
    return;
  }

  if (message?.type === 'transcribe') {
    const started = performance.now();
    try {
      if (recognizer === undefined) throw new Error('the GigaAM recognizer is not loaded');
      const stream = recognizer.createStream();
      stream.acceptWaveform({ sampleRate: Number(message.sampleRate) || 16000, samples: message.samples });
      recognizer.decode(stream);
      const result = recognizer.getResult(stream);
      parentPort.postMessage({
        type: 'result',
        id: message.id,
        text: typeof result?.text === 'string' ? result.text : '',
        inferenceSeconds: (performance.now() - started) / 1000,
      });
    } catch (error) {
      parentPort.postMessage({ type: 'error', id: message.id, message: messageOf(error) });
    }
  }
});
