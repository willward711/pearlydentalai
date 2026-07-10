# Voice Mode with Audio-Reactive Particle Orb — Design

Date: 2026-07-09
Status: Approved approach (B — custom canvas particle orb, no new dependencies)

## Goal

A full-screen, hands-free voice conversation mode, entered from the chat input bar. The
centerpiece is an orb made of a few hundred small dots that reacts to real audio: the user's
mic volume while listening, Pearly's actual voice while speaking. Modeled on ChatGPT's voice
mode. Inspired by open-source implementations (chevgan/react-ai-voice-visualizer,
aguscruiz/voiceorb) but written in-house on a 2D canvas — zero new dependencies.

## User experience

- A waveform button appears next to the existing mic button in the input bar (both chat and
  empty state). Shown only when `speechSupported` is true (same gate as the mic button).
- Tapping it opens a full-screen overlay: Pearly-branded gradient background, dot orb centered,
  status text below ("Listening…", "Thinking…", "Speaking…"), an X button (top-right) to exit.
- Conversation loop (hands-free): listening → user speaks → silence ends recognition → message
  sends → thinking while the answer streams → Pearly speaks the answer aloud → listening
  resumes automatically.
- Tap the orb while Pearly is speaking to interrupt her and start listening immediately.
  Tap the orb while listening to stop the mic (pause). Tap again to resume listening.
- X exits voice mode: stops recognition and audio, returns to the normal chat view. The full
  exchange is already in the message list and saved to history like any typed conversation.
- TTS is forced ON inside voice mode regardless of the user's `ttsEnabled` setting; the
  setting itself is not mutated.
- The AI/safety disclaimer line remains visible in the overlay (small text at the bottom),
  matching the compliance wording used elsewhere.

## Orb states and motion

Four states, one canvas, ~250–350 particles arranged around a circle:

| State     | Motion | Audio input |
|-----------|--------|-------------|
| idle      | slow orbital drift, gentle breathing | none |
| listening | dots displace outward proportional to live mic volume | mic via AnalyserNode |
| thinking  | tighter, faster swirl | none |
| speaking  | radial pulse driven by Pearly's voice amplitude | TTS `<audio>` via AnalyserNode |

- Volume is derived from `AnalyserNode.getByteTimeDomainData` RMS, smoothed
  (exponential moving average) to avoid jitter. No audio is recorded or stored.
- `prefers-reduced-motion`: particles hold a static ring with opacity-only state changes.
- Rendering: `requestAnimationFrame` loop on a `<canvas>`, devicePixelRatio-aware, paused
  when the overlay unmounts. Target 60fps; particle count trimmed on small screens.

## Architecture

New files:

- `components/voice-mode.tsx` — the full-screen overlay. Owns the voice conversation state
  machine (idle/listening/thinking/speaking), the SpeechRecognition instance for voice mode,
  and the Web Audio plumbing. Receives props from `chat-interface.tsx`:
  `{ open, onClose, sendMessage, messages, isLoading, language, speak, stopSpeaking, ttsAudioRef }`.
- `components/particle-orb.tsx` — presentation-only canvas orb. Props:
  `{ state: 'idle' | 'listening' | 'thinking' | 'speaking', level: number }` where `level`
  is 0–1 smoothed volume. Knows nothing about audio or chat; testable in isolation.
- `lib/use-audio-level.ts` — hook that returns a live 0–1 level for either a MediaStream
  (mic) or an HTMLAudioElement (TTS), creating/closing its own AudioContext + AnalyserNode.

Changes to existing files:

- `components/chat-interface.tsx` — add the waveform entry button; expose the existing
  `sendMessage`/TTS audio element ref to the overlay; force-speak the latest assistant
  message while voice mode is open even if `ttsEnabled` is false.

## Audio plumbing details

- Mic level: `navigator.mediaDevices.getUserMedia({ audio: true })` alongside
  SpeechRecognition (same permission the mic button already requests). Stream tracks are
  stopped whenever the state leaves `listening` and on exit.
- Pearly's voice level: `AudioContext.createMediaElementSource(ttsAudio)` →
  analyser → destination. Same-origin `/api/tts` audio, so no CORS issue. A given
  HTMLAudioElement can only be wired to a MediaElementSource once — the hook must create
  the source per audio element and reconnect per utterance (new Audio element per reply
  already exists in `speak()`).
- Browser-speech fallback (`speechSynthesis`) exposes no audio stream: the orb falls back
  to the preset speaking pulse (state-based) with `level` synthesized from a sine wave.

## Conversation state machine

```
enter → listening
listening --(final transcript)--> thinking (send message)
thinking --(assistant message complete)--> speaking
speaking --(audio ended)--> listening
speaking --(orb tapped)--> listening (stop audio)
listening --(orb tapped)--> paused-idle; tap again → listening
any state --(X)--> exit (cleanup: stop recognition, stop audio, close AudioContext)
```

- Recognition errors (`no-speech`, `not-allowed`, network): show a short status message in
  the overlay; `no-speech` restarts listening once, other errors drop to paused-idle rather
  than looping.
- Empty/whitespace transcripts do not send; return to listening.
- `isLoading` from the chat hook drives the thinking state; the existing auto-speak effect
  (or a voice-mode variant) triggers speaking.

## Error handling and edge cases

- No SpeechRecognition support → entry button never renders (existing `speechSupported`).
- Mic permission denied → status text explains, orb sits in idle, X still exits.
- TTS route failure → existing browser-speech fallback; orb uses preset pulse.
- Navigating away/unmount → full cleanup (recognition.stop, audio.pause, AudioContext.close,
  cancelAnimationFrame, MediaStream tracks stopped).
- Rapid open/close → all wiring lives in effects keyed on `open` with cleanup functions.

## Testing

Manual verification checklist (no test framework in repo):

1. Enter voice mode, ask a question hands-free, hear the answer, mic reopens.
2. Dots visibly react to voice volume (whisper vs. loud) and to Pearly's speech.
3. Interrupt mid-answer by tapping the orb; listening resumes instantly.
4. Exit and confirm the conversation appears in chat + history.
5. Deny mic permission → graceful message.
6. Toggle OS reduced-motion → static ring behavior.
7. Mobile viewport: layout, performance, and iOS Safari (webkit prefix) behavior.

## Out of scope (YAGNI)

- Wake words, always-listening, or barge-in voice activity detection.
- Recording, storing, or transmitting raw audio anywhere.
- WebGL/Three.js rendering.
- Changing the existing mic-button flow or the `ttsEnabled` setting semantics.
