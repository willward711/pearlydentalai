import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, MessageCircleHeart, Mic, Languages, BookmarkCheck, Github, HeartPulse } from 'lucide-react'
import Doodles from '@/components/landing/doodles'

const features = [
  {
    icon: MessageCircleHeart,
    title: 'Ask anything',
    desc: 'Friendly, easy-to-understand answers about teeth, gums, braces, and more.',
  },
  {
    icon: Mic,
    title: 'Talks & listens',
    desc: 'Speak your question out loud and Pearly can read her answers back to you.',
  },
  {
    icon: Languages,
    title: '12+ languages',
    desc: 'Chat in English, Spanish, Mandarin, Arabic, Hindi, and many more.',
  },
  {
    icon: BookmarkCheck,
    title: 'Remembers chats',
    desc: 'Sign in to keep your conversations saved on any device.',
  },
]

const exampleQuestions = [
  { icon: '🦷', title: 'Tooth Anatomy', prompt: 'Can you explain the anatomy of a tooth in a fun and easy way?' },
  { icon: '🪥', title: 'Brushing Tips', prompt: 'What are the best brushing techniques for healthy teeth?' },
  { icon: '🛡️', title: 'Cavity Prevention', prompt: 'How can I prevent cavities? Give me some helpful tips!' },
  { icon: '🧵', title: 'Flossing Guide', prompt: 'What is the correct way to floss, and why does it matter?' },
  { icon: '🥦', title: 'Foods for Teeth', prompt: 'Which foods are best and worst for my teeth?' },
]

export default function Home() {
  return (
    <main className="animated-gradient-bg relative min-h-screen text-white overflow-x-hidden">
      <Doodles />

      {/* Hero */}
      <section className="relative flex flex-col items-center px-6 pt-20 pb-16 text-center">
        <div className="pearly-float relative mb-8">
          <div className="relative w-36 h-36 rounded-full overflow-hidden ring-4 ring-white/80 shadow-2xl">
            <Image src="/pearly.jpg" alt="Pearly, a friendly cartoon tooth character" fill className="object-cover" priority />
          </div>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight drop-shadow-md max-w-2xl">
          Meet Pearly — your friendly dental health guide
        </h1>
        <p className="mt-4 text-lg text-white/85 max-w-xl leading-relaxed">
          A free AI companion that makes learning about teeth, gums, and healthy smiles simple and fun.
        </p>
        <Link
          href="/chat"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-white text-blue-700 px-8 py-4 text-lg font-extrabold shadow-xl hover:bg-blue-50 hover:scale-105 transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
        >
          Chat with Pearly
          <ArrowRight className="w-5 h-5" aria-hidden="true" />
        </Link>
      </section>

      {/* Feature cards */}
      <section className="relative px-6 pb-16" aria-label="What Pearly can do">
        <div className="mx-auto grid max-w-4xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="pearly-card rounded-3xl bg-white/12 border border-white/20 backdrop-blur-sm p-5 shadow-lg"
            >
              <f.icon className="w-8 h-8 mb-3 text-white" aria-hidden="true" />
              <h2 className="font-extrabold text-base mb-1">{f.title}</h2>
              <p className="text-sm text-white/80 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Example questions */}
      <section className="relative px-6 pb-16 text-center" aria-label="Example questions">
        <h2 className="text-xl font-extrabold mb-5">Try asking Pearly…</h2>
        <div className="mx-auto flex max-w-2xl flex-wrap justify-center gap-2.5">
          {exampleQuestions.map((q) => (
            <Link
              key={q.title}
              href={`/chat?q=${encodeURIComponent(q.prompt)}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-white/15 border border-white/25 backdrop-blur-sm hover:bg-white/25 hover:border-white/40 hover:scale-105 transition-all duration-150 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <span aria-hidden="true">{q.icon}</span>
              {q.title}
            </Link>
          ))}
        </div>
      </section>

      {/* Trust & safety */}
      <section className="relative px-6 pb-16" aria-label="Safety note">
        <div className="mx-auto max-w-2xl rounded-3xl bg-white/10 border border-white/20 backdrop-blur-sm p-6 text-center">
          <HeartPulse className="w-7 h-7 mx-auto mb-2 text-white/90" aria-hidden="true" />
          <h2 className="font-extrabold mb-2">Made for learning, not diagnosing</h2>
          <p className="text-sm text-white/80 leading-relaxed">
            Pearly is an educational tool. She can explain how teeth work and how to care for them, but she can&apos;t
            examine you or replace a real dentist. If something hurts or worries you, please see a dental professional.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative px-6 pb-10 text-center text-sm text-white/60">
        <p>
          Built by Will Ward ·{' '}
          <a
            href="https://github.com/willward711/pearlydentalai"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-white transition-colors"
          >
            <Github className="w-3.5 h-3.5" aria-hidden="true" />
            View the code on GitHub
          </a>
        </p>
      </footer>
    </main>
  )
}
