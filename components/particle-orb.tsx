'use client'

import { useEffect, useRef } from 'react'

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

type Particle = {
  angle: number
  baseR: number // resting orbit radius as a fraction of maxR
  curR: number // current radius fraction (lerped each frame)
  speed: number
  size: number
  phase: number
}

const STATE_COLOR: Record<OrbState, string> = {
  idle: '191, 219, 254', // blue-200
  listening: '125, 211, 252', // sky-300
  thinking: '165, 180, 252', // indigo-300
  speaking: '147, 197, 253', // blue-300
}

/**
 * A circle of small dots that drifts when idle, surges outward with mic volume
 * while listening, swirls tightly while thinking, and pulses with Pearly's
 * voice while speaking. Reads state and level through refs inside its own
 * requestAnimationFrame loop, so prop updates never restart the animation.
 */
export default function ParticleOrb({
  state,
  getLevel,
  size = 260,
}: {
  state: OrbState
  getLevel: () => number
  size?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<OrbState>(state)
  stateRef.current = state
  const getLevelRef = useRef(getLevel)
  getLevelRef.current = getLevel

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const center = size / 2
    const maxR = size * 0.42
    const COUNT = size < 220 ? 200 : 300

    const particles: Particle[] = Array.from({ length: COUNT }, () => {
      const baseR = 0.62 + Math.random() * 0.3
      return {
        angle: Math.random() * Math.PI * 2,
        baseR,
        curR: baseR,
        speed: (0.0025 + Math.random() * 0.004) * (Math.random() < 0.5 ? 1 : -1),
        size: 1.1 + Math.random() * 1.9,
        phase: Math.random() * Math.PI * 2,
      }
    })

    let raf = 0
    let t = 0

    const draw = () => {
      const mode = stateRef.current
      const level = Math.max(0, Math.min(1, getLevelRef.current()))
      const rgb = STATE_COLOR[mode]
      t += 1

      ctx.clearRect(0, 0, size, size)

      // Soft glowing core behind the dots
      const glow = ctx.createRadialGradient(center, center, 0, center, center, maxR)
      const coreAlpha = mode === 'idle' ? 0.10 : 0.16 + level * 0.18
      glow.addColorStop(0, `rgba(${rgb}, ${coreAlpha})`)
      glow.addColorStop(1, `rgba(${rgb}, 0)`)
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, size, size)

      for (const p of particles) {
        let targetR = p.baseR
        let speedMul = 0.5

        if (mode === 'listening') {
          // Dots surge outward with the user's voice
          targetR = p.baseR + level * 0.38 * Math.sin(p.phase + t * 0.05) ** 2 + level * 0.22
          speedMul = 1
        } else if (mode === 'thinking') {
          // Tight, fast swirl
          targetR = p.baseR * 0.62
          speedMul = 3.2
        } else if (mode === 'speaking') {
          // Radial pulse in rhythm with Pearly's voice
          targetR = p.baseR * (1 + level * 0.5) + 0.04 * Math.sin(t * 0.09 + p.phase)
          speedMul = 0.9
        } else {
          // Idle: gentle breathing
          targetR = p.baseR * (1 + 0.045 * Math.sin(t * 0.02 + p.phase))
        }

        if (reduceMotion) {
          // Static ring; only color/opacity communicate state
          p.curR = p.baseR
        } else {
          p.curR += (targetR - p.curR) * 0.08
          p.angle += p.speed * speedMul
        }

        const r = p.curR * maxR
        const x = center + Math.cos(p.angle) * r
        const y = center + Math.sin(p.angle) * r
        const alpha = reduceMotion
          ? mode === 'idle' ? 0.45 : 0.8
          : 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.03 + p.phase)) + level * 0.15

        ctx.beginPath()
        ctx.arc(x, y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb}, ${Math.min(1, alpha)})`
        ctx.fill()
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  )
}
