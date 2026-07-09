import type { CSSProperties } from 'react'

export function Tooth({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden="true">
      <path d="M12 2C8.1 2 5 4.9 5 8.5c0 2.6 1 4.4 1.5 7 .4 2.2 1 6.5 2.7 6.5 1.5 0 1.4-2.9 1.8-4.8.2-1 .6-1.6 1-1.6s.8.6 1 1.6c.4 1.9.3 4.8 1.8 4.8 1.7 0 2.3-4.3 2.7-6.5.5-2.6 1.5-4.4 1.5-7C19 4.9 15.9 2 12 2z" />
    </svg>
  )
}

export function Sparkle({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden="true">
      <path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6L12 0z" />
    </svg>
  )
}

export default function Doodles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <Tooth className="pearly-drift absolute left-[7%] top-[16%] w-10 h-10 text-white/15" />
      <Tooth className="pearly-drift absolute right-[10%] top-[28%] w-14 h-14 text-white/10" style={{ animationDelay: '4s' }} />
      <Tooth className="pearly-drift absolute left-[15%] bottom-[22%] w-8 h-8 text-white/10" style={{ animationDelay: '9s' }} />
      <Sparkle className="pearly-drift absolute right-[20%] top-[12%] w-5 h-5 text-white/25" style={{ animationDelay: '2s' }} />
      <Sparkle className="pearly-drift absolute left-[24%] top-[36%] w-4 h-4 text-white/20" style={{ animationDelay: '7s' }} />
      <Sparkle className="pearly-drift absolute right-[8%] bottom-[30%] w-6 h-6 text-white/15" style={{ animationDelay: '12s' }} />
    </div>
  )
}
