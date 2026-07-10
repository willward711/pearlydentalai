'use client'

import { useEffect, useRef, type MutableRefObject } from 'react'

/**
 * Live 0–1 loudness for a mic stream or a playing <audio> element, exposed as a
 * ref so consumers (the canvas orb) can read it every frame without triggering
 * React re-renders. Nothing is recorded — the analyser only yields a volume
 * number that is thrown away each frame.
 */
export function useAudioLevel(input: MediaStream | HTMLAudioElement | null): MutableRefObject<number> {
  const levelRef = useRef(0)

  useEffect(() => {
    levelRef.current = 0
    if (!input) return

    const Ctx: typeof AudioContext | undefined =
      window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return

    const ctx = new Ctx()
    let raf = 0
    let cancelled = false

    const start = async () => {
      try {
        await ctx.resume()
      } catch {}
      // If the context can't run (autoplay policy), bail out BEFORE wiring a
      // MediaElementSource — wiring one into a dead context would silence the
      // audio element entirely. The orb just falls back to preset motion.
      if (cancelled || ctx.state !== 'running') {
        try { await ctx.close() } catch {}
        return
      }

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512

      if (input instanceof HTMLAudioElement) {
        // Route element → analyser → speakers so playback stays audible
        const src = ctx.createMediaElementSource(input)
        src.connect(analyser)
        analyser.connect(ctx.destination)
      } else {
        // Mic: analyser only — never to the speakers (no echo)
        const src = ctx.createMediaStreamSource(input)
        src.connect(analyser)
      }

      const data = new Uint8Array(analyser.fftSize)
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / data.length)
        // Exponential smoothing keeps the dots lively without jitter
        levelRef.current = levelRef.current * 0.8 + Math.min(1, rms * 4) * 0.2
        raf = requestAnimationFrame(tick)
      }
      tick()
    }

    start()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      try { ctx.close() } catch {}
      levelRef.current = 0
    }
  }, [input])

  return levelRef
}
