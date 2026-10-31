# Russian voice replies (local)

A DSH plugin that lets the **model** decide what to say out loud: it calls a
`speak_summary` Tool with a short line, the Host synthesizes that text locally
with a Russian **Piper** voice, and the browser plays it from a speaker toggle in
the composer. Three kinds of lines are spoken: a one-sentence **intro** right
before a work phase that uses tools (“Приступаю к…”), short **progress** lines
about meaningful milestones while the work runs, and a 2–3 sentence **summary**
after every answer. The full answer is never read aloud.

## How it works

- **Tool `speak_summary`** (arguments: `text` of at most 400 characters, plus an
  optional `kind` of `intro`, `progress` or `summary`). While the mode is enabled
  the plugin adds a system-prompt section telling the model to announce each
  tool-using work phase with a one-sentence `intro` right before its first tool
  call, to speak a few one-sentence `progress` lines at meaningful milestones
  while the work runs, and to call the tool once after every answer — including
  short confirmations — with a 2–3 sentence `summary`. All in the user's
  language, without markdown or code.
- **Controls in three places, one preference.** A speaker toggle in
  `conversation.composer.dock` opens a small panel with the enable switch and the
  Russian voice list; the `settings.general.item` row (Settings → General →
  “Voice replies”) and the `plugins.detail.section` section on this bundle's page
  under **Plugins** offer the same switch and voice picker. All surfaces share
  one persisted value (`$DSH_HOME/tts-ru/state.json`).
- **Gender follows the voice.** Each voice carries its grammatical gender and the
  system-prompt section states it: with a female voice the model refers to itself
  in feminine forms (“я проверила”, “нашла”) and with a male voice in masculine
  ones (“я проверил”, “нашёл”), in the written answer and in every spoken line.
- **Prosody presets.** Besides the voice, two coarse controls are persisted:
  **intonation** (`calm` / `neutral` / `expressive`, mapped onto the VITS
  `noiseScale` and `noiseScaleW` inputs) and **tempo** (`slow` / `normal` / `fast`,
  a per-clip speed multiplier). Changing intonation rebuilds the synthesizer,
  because those inputs are fixed when the engine is created; tempo applies per
  clip without a reload.
- **Synthesis** runs in a worker thread through `sherpa-onnx-node` and `OfflineTts`
  with a VITS/Piper voice at 22.05 kHz. A clip is cached in memory by
  `sha256(voice + text)`, so a repeated summary is served from the cache.
- **Playback** is a keyed Tool view (`tool.call.toolview` for `speak_summary`):
  a compact row with the line, its duration and a play/stop button. All lines go
  through one serial queue, so an intro, progress lines and the closing summary
  never talk over each other — a waiting row shows “В очереди” until its turn.
  A new reply auto-plays while it streams in (subject to the browser's autoplay
  policy; the button always works); clips restored with the transcript — after
  switching sessions or refreshing the page — stay silent until clicked, so old
  chats never replay themselves. The row appears only when the model actually
  called the tool.
- **Audio stays on this machine.** Clips are served over an authenticated
  Connection route (`/api/tts-ru`, `action: "audio"`), held in memory only, and
  never written to a Session log.

## Pronunciation dictionary

Spoken lines can be rewritten before synthesis through
`$DSH_HOME/tts-ru/pronunciations.json` (same directory as `state.json`): a flat
`word -> replacement` object, matched as whole words and case-insensitively. The
file is re-read when its mtime changes, so edits apply without a restart.

```json
{
  "его": "ево",
  "сегодня": "севодня"
}
```

Replacements are plain text, so they fix grapheme-to-phoneme exceptions by
respelling. **Stress marks do not work with the stock espeak-ng Russian data**:
combining acutes (U+0301) are ignored, the espeak-ng phoneme-input `[[...]]`
syntax is not honoured by the Piper frontend, and sherpa-onnx exposes no lexicon
hook for Piper voices. Correcting stress therefore needs a different frontend or
engineering — see “Limitations”.

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
composer toolbar: enable it, pick a voice, keep chatting. The model announces
the work it starts, narrates key milestones, and attaches a short spoken summary
to every answer, including short confirmations.

## Limitations

- Russian only, single speaker per clip, medium-quality Piper voices. Prosody is
  limited to the coarse intonation/tempo presets: no SSML, no per-sentence
  emphasis, no emotion control.
- Stress is placed by espeak-ng's Russian rules. The stock data ignores
  combining-acute marks and there is no runtime lexicon hook for Piper voices,
  so a stress dictionary cannot be applied inside this pipeline; fixing stress
  would require a stress-capable frontend (e.g. a Silero-style model) or a
  rebuilt espeak-ng dictionary.
- The summary is written by the model: the plugin cannot force a call, so in rare
  cases an answer may arrive without audio.
- Clips live in memory: a page reload or Host restart clears them; the next
  summary re-renders and re-caches.
- Browser autoplay may require one click after page load before audio starts.
- Voice replies are a global preference for the profile, not per Session.
