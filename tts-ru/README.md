# Russian voice replies (local)

A DSH plugin that lets the **model** decide what to say out loud: it calls a
`speak_summary` Tool with a 2–3 sentence takeaway, the Host synthesizes that text
locally with a Russian **Piper** voice, and the browser plays it from a speaker
toggle in the composer. The full answer is never read aloud — only the short
summary the model writes for the ear.

## How it works

- **Tool `speak_summary`** (arguments: `text`, at most 400 characters). While the
  mode is enabled the plugin adds a system-prompt section telling the model to
  call it once after every substantive answer with a short spoken takeaway in the
  user's language, without markdown, code or lists.
- **Speaker toggle** in `conversation.composer.dock`: click it to open a small
  panel with an enable switch and the Russian voice list. The choice is persisted
  next to the model cache (`$DSH_HOME/tts-ru/state.json`).
- **Synthesis** runs in a worker thread through `sherpa-onnx-node` and `OfflineTts`
  with a VITS/Piper voice at 22.05 kHz. A clip is cached in memory by
  `sha256(voice + text)`, so a repeated summary is served from the cache.
- **Playback** is a keyed Tool view (`tool.call.toolview` for `speak_summary`):
  a compact row with the takeaway, its duration and a play/stop button. It
  auto-plays when the mode is on (subject to the browser's autoplay policy; the
  button always works) and only shows the row when the model actually called it.
- **Audio stays on this machine.** Clips are served over an authenticated
  Connection route (`/api/tts-ru`, `action: "audio"`), held in memory only, and
  never written to a Session log.

## Voices and assets

| Voice | Kind | Notes |
|---|---|---|
| `irina` | female | default |
| `dmitri` | male | |
| `denis` | male | |
| `ruslan` | male | |

Each voice is a ~63 MB ONNX model ([csukuangfj/vits-piper-ru_RU-*](https://huggingface.co/csukuangfj), pinned by revision); the phoneme-based Piper models also need
the `espeak-ng-data` archive (7 MB), downloaded from the sherpa-onnx release once.
Both are prepared on demand under `$DSH_HOME/tts-ru/` when the mode is enabled or
the first summary arrives. Model cards for these Piper voices list the training
data as RHVoice with an unknown licence, and `espeak-ng-data` is GPL data: the
plugin itself stays MIT and downloads these files at runtime instead of
redistributing them.

## Requirements

- DSH **0.2.1-rc.5** with the Cordis client bundle support (`dsh.client`).
- Platforms with `sherpa-onnx-node` prebuilt binaries (macOS arm64/x64, Linux
  glibc arm64/x64, Windows x64), CPU only.
- One-time network access to Hugging Face (with `hf-mirror.com` fallback) and
  GitHub releases (~70 MB total per voice).

## Install

```sh
plugin_manager install_bundle /Users/ruelephant/dev-project/deepseek/plugins/tts-ru
```

Then refresh the Harness page (⌘R). In a chat, the speaker icon appears in the
composer toolbar: enable it, pick a voice, keep chatting. The model will attach a
short spoken summary to substantive answers.

## Limitations

- Russian only, single speaker per clip, medium-quality Piper voices (no
  emotion control, no SSML).
- The summary is written by the model: the plugin cannot force a call, and a
  trivial answer legitimately has none.
- Clips live in memory: a page reload or Host restart clears them; the next
  summary re-renders and re-caches.
- Browser autoplay may require one click after page load before audio starts.
- Voice replies are a global preference for the profile, not per Session.
