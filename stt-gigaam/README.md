# GigaAM Russian speech (local)

A DSH **speech-to-text provider** plugin that adds fully local Russian recognition to the
experimental voice input: Sber's **GigaAM v3** CTC model, exported to ONNX and executed by
`sherpa-onnx` on the Host CPU. No cloud, no API keys, audio never leaves the machine.

## What it does

- Registers a second `ctx.speechToText` provider, id `gigaam-local`, advertised as
  `host-local` with the single language hint `ru`. The shipped provider (SenseVoiceSmall)
  covers `zh` / `en` / `yue` / `ja` / `ko` only, so Russian had no recognizer.
- Downloads the pinned model once (`model.int8.onnx`, 214 MiB, plus `tokens.txt`) into
  `$DSH_HOME/speech-to-text-gigaam`, verifies the exact byte size and the model SHA-256,
  then loads it in a worker thread. Preparation progress is reported through the same
  states the voice UI already renders (check → download → verify → load).
- Recognizes one complete 16 kHz mono PCM16 WAV per call and returns plain text with
  audio and inference durations. Inference takes ~0.3 s for 11 s of speech on an Apple
  Silicon CPU; the worker is reused between recordings and terminated on cancellation.

Nothing model-facing is registered: recordings and transcripts stay outside model
requests until the user submits the draft.

## Requirements

- DeepSeek Harness **0.2.1-rc.5** (the speech provider contract it implements).
- The experimental **voice input** bundle mounted, because the `speechToText` service
  lives there. This plugin stays pending until that service exists.
- Platforms with `sherpa-onnx-node` prebuilt binaries: macOS arm64/x64, Linux glibc
  arm64/x64, Windows x64. CPU only.
- One-time ~215 MiB download (Hugging Face, with `hf-mirror.com` fallback).

## Install

```sh
plugin_manager install_bundle /Users/ruelephant/dev-project/deepseek/plugins/stt-gigaam
```

For a local linked install the plugin keeps its own `node_modules` (it needs the native
`sherpa-onnx-node` package); a published install resolves that dependency through pnpm.

Then, in the Web UI:

1. Plugins → Experimental plugins → **Voice input** → enable it.
2. Plugins → the voice input bundle details (or Settings → Built-in plugins → voice
   input) → recognition preferences → provider **GigaAM v3 (Russian, local)**,
   language `ru`, then **Prepare** (downloads the model).
3. Record from the composer: the transcript is inserted into the draft, like the
   shipped provider.

The language value appears as the literal hint `ru` in the picker: the experimental
voice UI hardcodes display names only for the SenseVoice hints (`auto`, `zh`, `en`,
`yue`, `ja`, `ko`), and a plugin cannot change that map.

## Model and licensing

- Model: [GigaAM v3](https://github.com/salute-developers/GigaAM) by the GigaChat team,
  **MIT** licensed; Russian speech, character-wise CTC (no punctuation or capitalisation).
- ONNX export: [`csukuangfj/sherpa-onnx-nemo-ctc-giga-am-v3-russian-2025-12-16`](https://huggingface.co/csukuangfj/sherpa-onnx-nemo-ctc-giga-am-v3-russian-2025-12-16),
  pinned to revision `32a4c7cc81809bd132e2d935ab99e9e6ab47fbec`; the provider verifies
  the int8 model by SHA-256 `f86ebfa0429ced91be6054fc344827e9c6c2572f3c318416cd974b06f66437ec`.
- Runtime: `sherpa-onnx-node` 1.13.8 (Apache-2.0), the same runtime the shipped
  SenseVoice provider uses.

## Limitations

- One Russian model: the provider advertises the hints `auto` and `ru`. `auto` is the
  shared default and is also offered by SenseVoice; pick it before switching back to
  SenseVoice, because the shared preference rejects a hint the selected provider does
  not list. The language picker shows the literal `ru` label for Russian (the
  experimental voice UI hardcodes display names only for the SenseVoice hints).
- The transcript is raw CTC output: no punctuation, no capitalisation, no timestamps.
- First use needs network; later runs read the verified cache. Download progress is not
  resumable — a cancelled preparation restarts the file.
- The voice input feature itself is experimental upstream.
