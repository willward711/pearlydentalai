# Voice Mode with Audio-Reactive Particle Orb — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-screen hands-free voice conversation mode with a dot-particle orb that reacts to the user's mic volume and Pearly's actual voice.

**Architecture:** Extract the existing TTS logic from `chat-interface.tsx` into a shared `useSpeech` hook so both the chat view and the new voice overlay drive one audio pipeline. A `useAudioLevel` hook turns a mic stream or the TTS `<audio>` element into a smoothed 0–1 loudness ref (no React re-renders per frame). A presentation-only `ParticleOrb` canvas renders four states; a `VoiceMode` overlay owns the listen→think→speak→listen state machine and reuses the chat's existing `sendMessage`.

**Tech Stack:** React 19 / Next.js 16 client components, Web Speech API (SpeechRecognition already used by the mic button), Web Audio API (AnalyserNode), 2D canvas. No new dependencies.

## Global Constraints

- Zero new npm dependencies.
- No audio is recorded, stored, or transmitted; analysers produce a live volume number only.
- Voice mode forces speech output ON without mutating the user's `ttsEnabled` setting.
- Entry button renders only when `speechSupported` is true (same gate as the mic button).
- Respect `prefers-reduced-motion`: static ring, opacity-only state changes.
- The AI/compliance disclaimer line appears at the bottom of the overlay.
- Build must pass: `pnpm build`. No test framework exists; each task verifies via typecheck/build.

---

### Task 1: Extract shared speech hook (`lib/use-speech.ts`) and refactor chat-interface to use it

**Files:**
- Create: `lib/use-speech.ts`
- Modify: `components/chat-interface.tsx` (remove `speakWithBrowser`/`speak`/`stopSpeaking`/`ttsAudioRef`, lines ~104–105, 251–258, 325–377; replace call sites)

**Interfaces:**
- Produces: `useSpeech(language: string)` returning `{ speak(rawText, handlers?), stopSpeaking(), audioEl, source, }` where `handlers = { onEnd?: () => void }`, `audioEl: HTMLAudioElement | null` (state, reactive), `source: 'openai' | 'browser' | null`.
- Behavior identical to today's chat TTS: strip markdown via `stripForSpeech`, stream `/api/tts`, browser-speech fallback.

- [ ] Step 1: Write `lib/use-speech.ts` (full code in repo commit; key points: `audioEl` held in state so consumers can attach analysers; `onEnd` fires exactly once per utterance across all paths — ended, error-fallback ended, or stop).
- [ ] Step 2: Refactor `chat-interface.tsx`: `const { speak, stopSpeaking, audioEl: ttsAudioEl, source: ttsSource } = useSpeech(language)`; delete the local implementations; keep every call site (`startNewChat`, `loadConversation`, unmount cleanup, header mute button, replay buttons, auto-speak effect) unchanged in behavior.
- [ ] Step 3: `pnpm build` — expect success.
- [ ] Step 4: Commit `refactor: extract shared useSpeech hook from chat interface`.

### Task 2: Audio level hook (`lib/use-audio-level.ts`)

**Files:**
- Create: `lib/use-audio-level.ts`

**Interfaces:**
- Produces: `useAudioLevel(input: MediaStream | HTMLAudioElement | null): React.MutableRefObject<number>` — smoothed RMS 0–1, updated inside its own rAF loop; returns 0 when input is null.
- MediaStream sources connect analyser only (no echo); HTMLAudioElement sources connect analyser → destination so playback stays audible. If the AudioContext cannot reach `running` state, bail out **before** calling `createMediaElementSource` so audio is never silenced.

- [ ] Step 1: Write the hook (EMA smoothing `s = s*0.8 + min(1, rms*4)*0.2`; cleanup closes the context and cancels rAF).
- [ ] Step 2: `npx tsc --noEmit` (or `pnpm build`) — expect success.
- [ ] Step 3: Commit `feat: add useAudioLevel hook (Web Audio analyser → 0–1 level ref)`.

### Task 3: Particle orb canvas (`components/particle-orb.tsx`)

**Files:**
- Create: `components/particle-orb.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `<ParticleOrb state={OrbState} getLevel={() => number} size?={number} />` with `export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'`. Presentation-only; ~300 dots; reads state/level via refs inside its rAF loop so prop churn never restarts the animation.

- [ ] Step 1: Write the component. State motion: idle = slow orbit + breathing; listening = outward displacement ∝ level; thinking = faster tight swirl; speaking = radial pulse ∝ level. Per-particle radius lerps toward its target each frame so state changes glide. devicePixelRatio-aware sizing; `prefers-reduced-motion` renders a static ring whose color/opacity tracks state only.
- [ ] Step 2: `pnpm build` — expect success.
- [ ] Step 3: Commit `feat: add audio-reactive ParticleOrb canvas component`.

### Task 4: Voice mode overlay + chat integration

**Files:**
- Create: `components/voice-mode.tsx`
- Modify: `components/chat-interface.tsx` (entry button beside mic in `InputBar`, `voiceOpen` state, render overlay in both welcome and chat branches, gate auto-speak effect on `!voiceOpen`)

**Interfaces:**
- Consumes: `useSpeech` return object (Task 1), `useAudioLevel` (Task 2), `ParticleOrb`/`OrbState` (Task 3).
- Produces: `<VoiceMode language sendMessage messages isLoading speech onClose />` — mounted only while open; unmount performs full cleanup.

- [ ] Step 1: Write `voice-mode.tsx`. State machine: mount → listening; final transcript → thinking + `sendMessage`; assistant reply complete (`!isLoading` + new assistant id) → speaking via `speech.speak(text, { onEnd: resume listening })`; tap orb = interrupt (speaking→listening) / pause (listening→paused) / resume (paused→listening); X = cleanup + `onClose`. Mic: `getUserMedia` alongside SpeechRecognition for the level analyser; permission denial → friendly paused-state message (recognition may still work; orb just won't be mic-reactive). `no-speech`/silent ends restart listening, capped at 2 consecutive, then pause. Browser-speech fallback → synthetic sine level. Disclaimer line at bottom.
- [ ] Step 2: Wire chat-interface: `AudioLines` lucide icon button (aria-label "Start voice conversation") in `InputBar` next to `MicButton`, `stopListening()` before opening; render `{voiceOpen && <VoiceMode …/>}`; auto-speak effect returns early when `voiceOpen`.
- [ ] Step 3: `pnpm build` — expect success.
- [ ] Step 4: Commit `feat: full-screen voice mode with audio-reactive particle orb`.

### Task 5: Verification and push

- [ ] Step 1: `pnpm dev`, open the app in a browser, confirm: entry button renders, overlay opens with animating orb, status text cycles, X exits cleanly, conversation persists in chat.
- [ ] Step 2: Check reduced-motion and mobile-width rendering via devtools emulation where feasible.
- [ ] Step 3: Push `main` (fetch/rebase first — a parallel session commits to this repo).

## Self-Review Notes

- Spec coverage: entry gating (T4), four states + reactivity (T2/T3), hands-free loop + interrupt/pause (T4), forced TTS without mutating setting (T4 gate + VoiceMode speaking directly), fallback behaviors (T2 bail-out, T4 synthetic level), cleanup (T4 unmount), disclaimer (T4), reduced motion (T3). History saving needs no work — messages flow through the existing `useChat` list.
- Deviation from spec: components read `getLevel()`/refs instead of a `level: number` prop — avoids 60fps React re-renders; interface documented in Task 3.
