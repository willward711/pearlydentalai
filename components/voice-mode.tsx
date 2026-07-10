'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import ParticleOrb, { type OrbState } from '@/components/particle-orb'
import { useAudioLevel } from '@/lib/use-audio-level'
import type { useSpeech } from '@/lib/use-speech'

type Mode = 'listening' | 'thinking' | 'speaking' | 'paused' | 'denied'

const STATUS: Record<Mode, string> = {
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking — tap the orb to interrupt',
  paused: 'Paused — tap the orb to talk',
  denied: 'Microphone access is blocked — allow it in your browser settings, then tap the orb',
}

const ORB_STATE: Record<Mode, OrbState> = {
  listening: 'listening',
  thinking: 'thinking',
  speaking: 'speaking',
  paused: 'idle',
  denied: 'idle',
}

/**
 * Full-screen hands-free voice conversation: listen → send → think → speak →
 * listen again. Mounted only while voice mode is open; unmounting cleans up
 * the mic, recognition, and any playing audio.
 */
export default function VoiceMode({
  language,
  sendMessage,
  messages,
  isLoading,
  speech,
  onClose,
}: {
  language: string
  sendMessage: (msg: { text: string }) => void
  messages: any[]
  isLoading: boolean
  speech: ReturnType<typeof useSpeech>
  onClose: () => void
}) {
  // The chat switches component trees after the first message, remounting this
  // overlay mid-conversation — if a reply is already streaming, resume waiting
  // for it instead of restarting the mic.
  const [mode, setMode] = useState<Mode>(isLoading ? 'thinking' : 'listening')
  const [micStream, setMicStream] = useState<MediaStream | null>(null)

  const modeRef = useRef<Mode>(isLoading ? 'thinking' : 'listening')
  const recognitionRef = useRef<any>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const emptyEndsRef = useRef(0)
  const mountedRef = useRef(true)
  const sourceRef = useRef(speech.source)
  sourceRef.current = speech.source

  // Only speak replies that arrive while voice mode is open
  const lastAssistantIdRef = useRef<string | null>(
    [...messages].reverse().find((m) => m.role === 'assistant')?.id ?? null,
  )

  const setModeBoth = useCallback((m: Mode) => {
    modeRef.current = m
    setMode(m)
  }, [])

  const stopMic = useCallback(() => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    setMicStream(null)
  }, [])

  const stopRecognition = useCallback(() => {
    const r = recognitionRef.current
    recognitionRef.current = null
    if (r) {
      r.onresult = null
      r.onerror = null
      r.onend = null
      try { r.stop() } catch {}
    }
  }, [])

  const startListening = useCallback(() => {
    if (!mountedRef.current) return
    speech.stopSpeaking()
    stopRecognition()
    setModeBoth('listening')

    // Mic stream feeds the analyser only (never recorded). If it fails, the
    // orb just won't be volume-reactive; recognition handles its own errors.
    if (!micStreamRef.current) {
      navigator.mediaDevices
        ?.getUserMedia({ audio: true })
        .then((stream) => {
          if (!mountedRef.current || modeRef.current !== 'listening') {
            stream.getTracks().forEach((t) => t.stop())
            return
          }
          micStreamRef.current = stream
          setMicStream(stream)
        })
        .catch(() => {})
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setModeBoth('paused')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = language || navigator.language || 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript as string
      if (!transcript.trim()) return
      emptyEndsRef.current = 0
      stopMic()
      setModeBoth('thinking')
      sendMessage({ text: transcript })
    }
    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        stopMic()
        setModeBoth('denied')
      }
      // 'no-speech' and friends fall through to onend, which decides on retry
    }
    recognition.onend = () => {
      if (!mountedRef.current || modeRef.current !== 'listening') return
      // Ended without a transcript (silence). Retry a couple of times, then rest.
      emptyEndsRef.current += 1
      if (emptyEndsRef.current <= 2) {
        startListening()
      } else {
        stopMic()
        setModeBoth('paused')
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      setModeBoth('paused')
    }
  }, [language, sendMessage, speech, setModeBoth, stopMic, stopRecognition])

  // Kick off on mount; full cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    if (modeRef.current === 'listening') startListening()
    return () => {
      mountedRef.current = false
      stopRecognition()
      stopMic()
      speech.stopSpeaking()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When the answer finishes streaming, speak it, then resume listening.
  // Also accepts replies that land while listening (covers the remount race
  // right after the first message is sent).
  useEffect(() => {
    if ((modeRef.current !== 'thinking' && modeRef.current !== 'listening') || isLoading) return
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant' || last.id === lastAssistantIdRef.current) return
    lastAssistantIdRef.current = last.id
    stopRecognition()
    stopMic()
    const text = last.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join(' ')
    if (!text.trim()) {
      startListening()
      return
    }
    setModeBoth('speaking')
    speech.speak(text, {
      onEnd: () => {
        if (mountedRef.current && modeRef.current === 'speaking') startListening()
      },
    })
  }, [messages, isLoading, speech, setModeBoth, startListening, stopRecognition, stopMic])

  const handleOrbTap = useCallback(() => {
    const m = modeRef.current
    if (m === 'speaking') {
      startListening() // interrupts: startListening stops the audio first
    } else if (m === 'listening') {
      stopRecognition()
      stopMic()
      setModeBoth('paused')
    } else if (m === 'paused' || m === 'denied') {
      emptyEndsRef.current = 0
      startListening()
    }
    // 'thinking' ignores taps — the reply is already on its way
  }, [startListening, stopRecognition, stopMic, setModeBoth])

  const handleClose = useCallback(() => {
    stopRecognition()
    stopMic()
    speech.stopSpeaking()
    onClose()
  }, [stopRecognition, stopMic, speech, onClose])

  // Escape closes voice mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleClose])

  // Audio levels: mic while listening, Pearly's actual voice while speaking
  const micLevelRef = useAudioLevel(mode === 'listening' ? micStream : null)
  const ttsLevelRef = useAudioLevel(
    mode === 'speaking' && speech.source === 'openai' ? speech.audioEl : null,
  )
  const getLevel = useCallback(() => {
    const m = modeRef.current
    if (m === 'listening') return micLevelRef.current
    if (m === 'speaking') {
      // Browser-speech fallback exposes no audio stream — use a gentle synthetic pulse
      if (sourceRef.current === 'browser') return 0.3 + 0.25 * Math.sin(performance.now() / 160)
      return ttsLevelRef.current
    }
    return 0
  }, [micLevelRef, ttsLevelRef])

  return (
    <div
      className="fixed inset-0 z-[60] animated-gradient-bg flex flex-col items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      aria-label="Voice conversation with Pearly"
    >
      <button
        type="button"
        onClick={handleClose}
        aria-label="Exit voice mode"
        className="absolute top-4 right-4 p-2.5 rounded-xl text-white/70 hover:text-white hover:bg-white/15 transition-all"
      >
        <X className="w-6 h-6" />
      </button>

      <button
        type="button"
        onClick={handleOrbTap}
        aria-label={
          mode === 'speaking'
            ? 'Interrupt Pearly and start talking'
            : mode === 'listening'
              ? 'Pause listening'
              : 'Start talking'
        }
        className="rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40 transition-transform active:scale-95"
      >
        <ParticleOrb state={ORB_STATE[mode]} getLevel={getLevel} />
      </button>

      <p aria-live="polite" className="mt-6 text-white/90 text-base font-semibold text-center max-w-sm">
        {STATUS[mode]}
      </p>
      <p className="mt-2 text-white/50 text-xs text-center">
        Nothing you say is recorded — your voice is used only in the moment.
      </p>

      <p className="absolute bottom-5 left-6 right-6 text-center text-xs text-white/50 leading-relaxed">
        Pearly is an AI and can make mistakes — for education only, not professional advice,
        diagnosis, or treatment. In an emergency, call 911.
      </p>
    </div>
  )
}
