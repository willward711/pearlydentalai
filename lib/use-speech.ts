'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { stripForSpeech } from '@/components/pearly-message'

export type SpeakHandlers = {
  /** Fires exactly once when the utterance finishes, errors out, or is stopped. */
  onEnd?: () => void
}

export type SpeechSource = 'openai' | 'browser' | null

/**
 * Shared Pearly voice pipeline: OpenAI TTS streamed through an <audio> element,
 * with browser speechSynthesis as the fallback. Used by both the chat view and
 * voice mode so only one thing can ever be speaking at a time.
 */
export function useSpeech(language: string) {
  // audioEl lives in state (not just a ref) so voice mode can attach an analyser
  // to the current utterance's element reactively.
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)
  const [source, setSource] = useState<SpeechSource>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const onEndRef = useRef<(() => void) | null>(null)

  const finish = useCallback(() => {
    const cb = onEndRef.current
    onEndRef.current = null
    setAudioEl(null)
    setSource(null)
    cb?.()
  }, [])

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    window.speechSynthesis?.cancel()
    // Stopping is not "finished speaking" for the hands-free loop — the caller
    // decides what happens next, so drop the pending onEnd instead of firing it.
    onEndRef.current = null
    setAudioEl(null)
    setSource(null)
  }, [])

  const speakWithBrowser = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      finish()
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.05
    utterance.pitch = 1.1

    // Pick the best available female English voice
    const voices = window.speechSynthesis.getVoices()
    const femaleVoice =
      voices.find(v => v.name === 'Samantha') ||                                          // macOS
      voices.find(v => v.name === 'Karen') ||                                             // macOS
      voices.find(v => v.name.includes('Jenny') && v.lang.startsWith('en')) ||           // Windows
      voices.find(v => v.name.includes('Aria') && v.lang.startsWith('en')) ||            // Windows
      voices.find(v => v.name.includes('Zira') && v.lang.startsWith('en')) ||            // Windows
      voices.find(v => v.name === 'Google US English') ||                                 // Chrome
      voices.find(v => v.name.toLowerCase().includes('female') && v.lang.startsWith('en')) ||
      voices.find(v => v.lang.startsWith('en-US') && !v.name.toLowerCase().includes('male'))
    if (femaleVoice) utterance.voice = femaleVoice

    if (language) utterance.lang = language
    utterance.onend = finish
    utterance.onerror = finish
    setSource('browser')
    window.speechSynthesis.speak(utterance)
  }, [language, finish])

  const speak = useCallback(async (rawText: string, handlers?: SpeakHandlers) => {
    stopSpeaking()
    // Strip markdown, URLs, and the sources line so the voice reads clean prose
    const text = stripForSpeech(rawText)
    onEndRef.current = handlers?.onEnd ?? null
    if (!text) {
      finish()
      return
    }
    // Pointing the audio element at the URL lets the browser start playing
    // while OpenAI is still generating the rest of the clip
    const audio = new Audio('/api/tts?text=' + encodeURIComponent(text.slice(0, 4000)))
    audio.preload = 'auto'
    audioRef.current = audio
    setAudioEl(audio)
    setSource('openai')

    let fellBack = false
    const fallback = () => {
      if (fellBack) return
      fellBack = true
      if (audioRef.current === audio) audioRef.current = null
      setAudioEl(null)
      speakWithBrowser(text)
    }
    audio.onerror = fallback
    audio.onended = () => {
      if (audioRef.current === audio) audioRef.current = null
      if (!fellBack) finish()
    }
    try {
      await audio.play()
    } catch {
      fallback()
    }
  }, [stopSpeaking, speakWithBrowser, finish])

  // Safety net: stop audio when the owning component unmounts
  useEffect(() => () => {
    audioRef.current?.pause()
    window.speechSynthesis?.cancel()
  }, [])

  return { speak, stopSpeaking, audioEl, source }
}
