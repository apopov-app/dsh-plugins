# Voice assistant (local, Russian)

A DSH plugin that adds a floating animated orb to the conversation. Clicking it
opens a hands-free voice mode: the microphone stays open, speech is transcribed
locally (official speech Remote, GigaAM provider), the model answers through the
chat and speaks its lines through `assistant_say`, and the user can interrupt the
assistant simply by talking (barge-in).

Everything is local: the plugin registers its **own** Russian recognizer
(GigaAM v3 CTC, ONNX through `sherpa-onnx`) on the DSH speech registry and
synthesizes with `sherpa-onnx` Piper Russian voices. No cloud TTS/STT is used.

## How it works

- **Tool `assistant_say`** (arguments: `text`, `kind` of `intro`, `progress` or
  `reply`). While voice mode is on, the plugin injects a system-prompt section
  that tells the model to narrate what it does (`intro` before a tool-using work
  phase, `progress` at meaningful milestones) and to finish every turn with one
  `reply` call containing the spoken answer. The Host synthesizes the line and
  caches the WAV in memory; the browser plays it.
- **Floating orb** in the conversation, states: idle, listening, thinking,
  speaking; the panel shows the live level ring, the last heard utterance, the
  last spoken line, and the voice picker.
- **Voice loop**: VAD (RMS with hysteresis) opens the utterance, `MediaRecorder`
  captures it, it is resampled to 16 kHz mono WAV, transcribed, and submitted as
  a normal chat message. After the `reply` clip finishes playing, the assistant
  goes back to listening.
- **Barge-in**: in hold-to-talk mode, pressing the button while the assistant
  speaks stops playback and records the new utterance; in always-listening mode
  the VAD does the same on detected speech. The transcript is delivered to
  the running Session immediately with *steer* delivery (the turn is
  interrupted) instead of being appended to the composer queue, so the exchange
  behaves like a spoken conversation. Composer delivery remains a fallback when
  the Session API is unavailable.
- **Voices**: `irina` (female), `dmitri`, `denis`, `ruslan`; intonation
  (`calm`/`neutral`/`expressive`) and tempo (`slow`/`normal`/`fast`) presets.
  The selected voice's grammatical gender is reflected in spoken self-reference.

## Orb controls and settings

- **Press and hold the orb** to talk: push mode arms the microphone for exactly
  that press, so a click starts listening immediately without opening any panel.
  Releasing sends the utterance.
- **Right-click the orb** opens the compact panel (status, quick controls, close).
  Escape closes voice mode.
- **Settings live in the normal Settings surfaces**: Settings → General has a
  “Voice assistant” row, and the plugin's page under **Plugins** has the same
  section, with microphone mode, voice, intonation and tempo. Both persist in
  `$DSH_HOME/voice-assistant/state.json`.
- In continuous mode a plain left click keeps the old panel toggle behaviour.

## Voices and languages

The voice picker offers the Russian Piper voices (`irina`, `dmitri`, `denis`,
`ruslan`) and one English voice (`en_US-lessac-medium`, ~63 MB, downloaded into
`$DSH_HOME/voice-assistant` on first selection). One voice reads the whole line:
pick a Russian voice for Russian and the English voice for English. Intonation
and tempo apply to whichever voice is selected. The prompt tells the model to
speak in the selected voice's language instead of mixing the two on purpose.

## Listening modes

- **Hold to talk** (default): the microphone is armed only while the
  hold-to-talk button in the panel is pressed. Movie, TV or room audio never
  reaches recognition, and releasing the button sends the utterance. Holding the
  button while the assistant speaks also barges in.
- **Always listening**: the VAD keeps the microphone open for hands-free
  barge-in. Use it in a quiet room; speaker audio will be recognized as speech.

## Recognition provider

The plugin owns the local Russian provider it needs: it registers
`gigaam-local` (GigaAM v3 CTC, Russian, `host-local`) on the Host speech
registry, exactly as the retired `@apopov-app/dsh-stt-gigaam` bundle did, and
swallows nothing else: the official voice-input bundle still mounts the speech
Remote carrier the browser talks to. Model assets are shared with the old
plugin's cache (`$DSH_HOME/speech-to-text-gigaam`, ~225 MB) and only downloaded
by an explicit `prepare` when missing.

## Install

```sh
plugin_manager install_bundle /Users/ruelephant/dev-project/deepseek/plugins/voice-assistant
```

Then restart the app. The old local plugins (`@apopov-app/dsh-tts-ru` and
`@apopov-app/dsh-stt-gigaam`) are no longer part of the profile; their model
caches are reused. The official voice-input bundle stays enabled because it
mounts the speech Remote used by this plugin.

## Requirements

- DSH 0.2.1-rc.5 with the Cordis client bundle support.
- The official `@deepseek-ai/dsh-experimental-voice-input-bundle` (it mounts the
  speech Remote carrier; the recognizer itself ships with this plugin).
- `$DSH_HOME/tts-ru` voice assets (Piper voices + `espeak-ng-data`); the plugin
  falls back to downloading them into `$DSH_HOME/voice-assistant` if missing.
- `$DSH_HOME/speech-to-text-gigaam` model cache (downloaded on first prepare).

## Limitations (MVP)

- One voice per line, no streaming synthesis: each spoken line is a complete WAV.
- VAD is energy-based; a very noisy room may false-trigger.
- Barge-in cannot cancel the running model turn; the new utterance is queued by
  the composer.
- Stress placement is up to espeak-ng (see the `tts-ru` README for details).
