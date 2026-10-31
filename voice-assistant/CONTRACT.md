# Voice-assistant plugin — build contract (v1 MVP)

Package root: `/Users/ruelephant/dev-project/deepseek/plugins/voice-assistant`
Package name: `@apopov-app/dsh-voice-assistant`
Plain JS, no build step, ESM host half (`index.js`, `worker.js`) and a
hand-written client bundle (`client.js`) exactly in the style of the existing
sibling plugin `/Users/ruelephant/dev-project/deepseek/plugins/tts-ru/` —
read `tts-ru/index.js`, `tts-ru/worker.js`, `tts-ru/client.js` first.
**Never modify anything under `tts-ru/`.**

The goal: one self-contained "voice assistant": a floating animated orb next to
the chat composer. Clicking it opens voice mode: continuous microphone
conversation, local Russian STT (official speech Remote), local Piper TTS (own
sherpa worker), barge-in (user speech interrupts playback), and the model
narrates what it does (`assistant_say` tool with kinds `intro` / `progress` /
`reply`).

---

## Host half (`index.js`, `worker.js`)

`export const inject = ['connection', 'tools', 'systemPrompt'];`
`export function apply(ctx) { ... }`

State dir: `$DSH_HOME/voice-assistant` (`state.json`:
`{ enabled, voice, intonation, rate }`). Reuse the *downloaded assets* from
`$DSH_HOME/tts-ru` (`voices/*.onnx`, `voices/*.tokens.txt`, `espeak-ng-data/`)
when they are ready; otherwise download them into `$DSH_HOME/voice-assistant`
using the same code/logic as `tts-ru/index.js` (copy `VOICES`, `ESPEAK`,
`ORIGINS`, `voicePaths`, `voiceReady`, `espeakReady`, `extractTar`, `download`,
`sha256Of`, `encodeWav`, `Assets`, `TtsWorker`; reimplement the worker as
`worker.js` with `enableExternalBuffer: false` and noiseScale/noiseScaleW/speed
support, exactly like `tts-ru/worker.js`).

HTTP route (Connection fetch, POST JSON, path `/api/voice-assistant`):
- `{ action: 'state' }` → `{ enabled, voice, intonation, rate, voices: [{id,title,ready,bytes}], intonations: [...], rates: [...], error, preparing }`
- `{ action: 'config', enabled?, voice?, intonation?, rate? }` → same snapshot (persist; validate ids)
- `{ action: 'tts', text, kind }` → synthesize, cache clip in memory (max 32, sha256 key),
  return `{ audioId, seconds, voice, kind }` (this is the same pipeline the tool uses)
- `{ action: 'audio', id }` → `audio/wav` bytes, 404 when evicted

Registered tool `assistant_say`:
- parameters: `{ text: string (<= 600 chars), kind: 'intro'|'progress'|'reply' }`
  (`additionalProperties: false`, `required: ['text']`, `kind` defaults to `'reply'`)
- output render text: `voice assistant line prepared: Ns`; `presentationMeta:
  { audioId, seconds, kind, text: text.slice(0,240) }` so the client tool view can
  play it.
- execute: normalize whitespace, cap at 600 chars; if `enabled === false` return
  `{ spoken: false, reason: 'voice assistant mode is off' }`; synthesize via the
  same speech path; return `{ spoken: true, audioId, seconds, kind, voice }`.

System-prompt section `voice-assistant:mode` (registered via
`ctx.systemPrompt.section`, order after `TOOL_REPORT`, text function returns `''`
when state `enabled === false`):
```
Voice assistant mode is enabled: the user talks to you by microphone and hears
your lines spoken through the `assistant_say` tool.
Narrate what you do: before a work phase that will use tools call
`assistant_say` once with kind "intro" and one short spoken sentence naming the
task; while working call it at meaningful milestones with kind "progress" (a few
per task, never repeat a line).
Always finish the turn with exactly one `assistant_say` call with kind "reply":
the complete conversational answer the user hears, 1-4 short sentences of
natural spoken Russian, plain prose (no markdown, no code, no lists). The written
answer can stay concise; the spoken reply is what the user relies on.
Keep every spoken line short; never read out file paths, code or tool names.
```
Also make the selected voice's grammatical gender influence self-reference (ru:
`irina` → feminine forms, male voices → masculine forms) in a sentence appended
to the section.

Voice presets (ids must match `tts-ru/index.js`):
`irina` (female), `dmitri`, `denis`, `ruslan`; intonations `calm|neutral|expressive`
(noiseScale/noiseScaleW presets), rates `slow|normal|fast` (0.85/1/1.15).

## Client half (`client.js`)

Format: `window.__ModuleLoader__.load({ id: '@apopov-app/dsh-voice-assistant', factory(require) { ... return { inject: [...], apply(ctx) {...} } } });`
Baseline `require` modules available: `react`, `react-dom`, `react/jsx-runtime`,
`@deepseek-ai/dsh-client-ui-primitives`. Use `require('react-dom')` +
`createPortal` to render a fixed-position floating layer into `document.body`.

`inject`: `['slots', 'locale', 'remote.speech']` (also `ctx.remote.speech` may be
missing → show a readable error state in the orb panel instead of crashing).

Register ONE slot: `conversation.input.overlay` (list slot inside the composer
card, session-scoped; renders inside `div[data-composer-overlay]` whose CSS is
`position:absolute; inset:0 0 auto; height:0`). The component receives standard
session props (at least `sessionId`, `inputActions`, `t`; hooks such as
`useConversation` may exist — access defensively). Register its dictionaries
first (`ctx.locale.register(NS, { ru, en, zh })`), inject CSS like
`tts-ru/client.js` does, and `ctx.effect(() => ...)` for cleanup.

The component returns portals:
1. **Orb**: fixed button at the right side of the conversation area (e.g.
   `right: 24px; bottom: 120px`), 56px circle, animated gradient glass ball
   with pulsing rings whose animation depends on state (`idle`, `listening`,
   `thinking`, `speaking`); tooltip "Голосовой ассистент". Click toggles voice
   mode (opens/closes the panel and starts/stops the mic).
2. **Voice panel**: compact card (~380px wide, glassy, rounded, subtle
   backdrop) anchored bottom-right above the orb with: big animated orb, state
   line ("Слушаю…", "Думаю…", "Говорю…", "Нажмите, чтобы говорить"), the last
   heard utterance + last spoken line, a mic-level ring, voice `<select>`
   (irina/dmitri/denis/ruslan) and a close button. Keep the chat usable behind.

Controller (module scope singleton, plain class):
- `state`: `off | starting | listening | recording | transcribing | thinking | speaking`
- Mic: one `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })`
  stream kept for the whole voice mode; `AudioContext` + `AnalyserNode`
  (`fftSize` 1024) for continuous RMS.
- VAD: speech opens when RMS > 0.02 for 3 consecutive frames (~48ms); utterance
  ends after 900ms below 0.013 (min utterance 350ms). While the assistant is
  speaking raise the open threshold to 0.035 to avoid self-triggering.
- Capture the utterance with `MediaRecorder` (start when speech opens, stop on
  end), decode + resample to 16 kHz mono with `OfflineAudioContext`, encode a
  16-bit PCM WAV (copy the `encodeWave` helper from
  `/tmp/asarx/voice-input.js` lines ~1450-1500), base64 it and call
  `ctx.remote.speech.transcribe({ audioBase64, ...selection })` where `selection`
  comes from `ctx.remote.speech.catalog()` (`{ ok, value: { selection } }`).
  Result is `{ ok, value: { text } }`; throw on `ok === false`.
- Sending: `inputActions.setDraft(text)` then `inputActions.submit()` after a
  `setTimeout(..., 0)` (Submit reads the current draft projection). If
  `inputActions` is unavailable, keep the transcript visible with an error.
- Playback: a serial clip queue (fetch `POST /api/voice-assistant {action:'audio', id}`
  → blob → `new Audio(URL.createObjectURL(blob))`); route for this plugin is
  `api/voice-assistant` (document-relative, like `tts-ru`). One clip at a time;
  revoke object URLs.
- Tool integration: register `tool.call.toolview` keyed `assistant_say`; its
  component receives `{ phase, block }` where `phase === 'result'` carries
  `block.meta = { audioId, seconds, kind, text }`; forward the clip to the
  controller (`controller.playClip(meta, sessionKey)`) and render a minimal
  (height ~0) row. The controller plays it through the serial queue.
- After the clip with `kind === 'reply'` finishes and the queue drains → resume
  `listening`, clear the "thinking" state.
- Barge-in: while playing (state `speaking`), keep VAD active. If speech opens
  (threshold as above): stop/pause current audio, clear the queue, switch to
  `recording` for the new utterance. Also allow barge-in during `thinking`
  (record the next utterance and send it; the composer queue handles the busy
  session).
- Voice mode start: `ctx.remote.speech.prepare` may be required — if
  `catalog()` reports the selected provider preparation phase is not
  ready/standby/waking, call `ctx.remote.speech.prepare(providerId)` and show
  "Готовлю модель…"; do not download implicitly without a user gesture beyond
  the click that opened the mode.
- Host state: on voice mode open call `config({ enabled: true })`; on close
  `config({ enabled: false })` and stop mic/audio. Voice/intonation/rate selects
  call `config({...})`.

Also expose a tiny settings section? NOT required for the MVP: the voice select
inside the panel and the persisted host state are enough.

## Verification

- `node --check index.js` must pass (use `node -e 'import("file://...").then(...)'` to
  prove the module loads, like we did for `tts-ru`).
- `node --check worker.js`, `node --check client.js` must pass.
- No network access at build time is required: the host downloads voice assets
  lazily only if `$DSH_HOME/tts-ru` assets are missing (they exist on this
  machine).
- Do not restart the app and do not edit `~/.dsh/profiles/desktop` — the Lead
  wires the plugin into the profile.

Reference extraction of DSH client internals (already unpacked for you):
`/tmp/asarx/voice-input.js` (mic/recording/transcribe reference),
`/tmp/asarx/conversation.js` (composer shell, inputActions),
`/tmp/asarx/ui-tool.js` (tool view phase semantics).
