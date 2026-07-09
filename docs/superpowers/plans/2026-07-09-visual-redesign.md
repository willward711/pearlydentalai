# Pearly Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a friendly & playful landing page at `/`, move the chat to `/chat`, and polish the chat screen (greeting speech bubble, settings popover, decluttered header, component extraction) — with zero new dependencies.

**Architecture:** Two independent tracks. **Track A (branch `feat/landing-page`)** owns the new routes and landing page: `app/page.tsx` (rewritten), `app/chat/page.tsx` (new), `components/landing/doodles.tsx` (new), landing keyframes appended to `app/globals.css`, plus a small `initialQuestion` prop added to `ChatInterface`. **Track B (branch `feat/chat-polish`)** owns everything else inside the chat UI: empty-state greeting, `components/chat-settings.tsx` (new popover), `components/history-sidebar.tsx` (extraction), `lib/languages.ts` (new). The tracks touch `components/chat-interface.tsx` in different regions and `app/globals.css` in different regions (Track A appends at end of file; Track B inserts mid-file) so they merge cleanly.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, existing shadcn/ui components (Popover), lucide-react, CSS-only animations. Package manager: pnpm.

## Global Constraints

- **No new dependencies.** Do not modify `package.json` or the lockfile.
- **Preserve all existing functionality unchanged:** voice input (SpeechRecognition), TTS, 12+ language selector, Supabase auth + chat history, localStorage guest history, dark mode.
- Font is already Nunito globally (`app/layout.tsx`) — do not add fonts.
- All animations must be CSS-only and disabled under `prefers-reduced-motion: reduce`.
- Never commit secrets or `.env*` files. If `pnpm build` fails on missing Supabase env vars, copy `.vercel/.env.development.local` from the main working directory (`C:\Users\willw\Claude\Projects\pearlydentalai`) to `.env.local` in your worktree (it is gitignored) — do NOT stage it.
- Verify with `pnpm install` (first time in a worktree) then `pnpm build` — must succeed with no type errors.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

# TRACK A — Landing page & routes (branch `feat/landing-page`)

### Task A1: `/chat` route with `?q=` auto-send

**Files:**
- Create: `app/chat/page.tsx`
- Modify: `components/chat-interface.tsx` (ONLY two small regions: the component signature at line ~106, and one new effect after the `useEffect(() => setMounted(true), [])` line ~146. Touch NOTHING else in this file — another branch is editing other regions of it.)

**Interfaces:**
- Produces: `ChatInterface` accepts optional prop `initialQuestion?: string`. When present and non-blank, the chat auto-sends it exactly once on mount.

- [ ] **Step 1: Create `app/chat/page.tsx`**

```tsx
import type { Metadata } from 'next'
import ChatInterface from '@/components/chat-interface'

export const metadata: Metadata = {
  title: 'Chat with Pearly',
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  return <ChatInterface initialQuestion={q} />
}
```

- [ ] **Step 2: Add the prop to `ChatInterface`**

Change the component signature in `components/chat-interface.tsx` from:

```tsx
export default function ChatInterface() {
```

to:

```tsx
export default function ChatInterface({ initialQuestion }: { initialQuestion?: string }) {
```

- [ ] **Step 3: Add the auto-send effect**

Immediately after the line `useEffect(() => setMounted(true), [])` add:

```tsx
  // Auto-send a question passed via /chat?q= (from landing page topic pills)
  const initialSentRef = useRef(false)
  useEffect(() => {
    if (!initialQuestion?.trim() || initialSentRef.current) return
    initialSentRef.current = true
    sendMessage({ text: initialQuestion })
  }, [initialQuestion, sendMessage])
```

Note: `useRef` and `useEffect` are already imported. `sendMessage` comes from the existing `useChat` call — this effect must be placed AFTER the `const { messages, sendMessage, status, setMessages } = useChat(...)` declaration (i.e., after line ~141), otherwise `sendMessage` is used before declaration. Place it right after the `useEffect(() => setMounted(true), [])` line, which is already after `useChat`.

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: success, `/chat` appears in the route list.

- [ ] **Step 5: Commit**

```bash
git add app/chat/page.tsx components/chat-interface.tsx
git commit -m "feat: add /chat route with ?q= auto-send support"
```

### Task A2: Landing page keyframes + doodle components

**Files:**
- Modify: `app/globals.css` (APPEND at end of file only)
- Create: `components/landing/doodles.tsx`

**Interfaces:**
- Produces: CSS classes `.pearly-float`, `.pearly-drift`; component `Doodles` (default export, no props) rendering absolutely-positioned decorative SVGs; also exports `Tooth` and `Sparkle` ({ className?: string; style?: React.CSSProperties }).

- [ ] **Step 1: Append to `app/globals.css`** (at the very end of the file):

```css
/* Landing: floating hero avatar */
@keyframes pearly-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-12px); }
}
.pearly-float { animation: pearly-float 5s ease-in-out infinite; }

/* Landing: slow-drifting doodles */
@keyframes pearly-drift {
  0%   { transform: translate(0, 0) rotate(0deg); }
  33%  { transform: translate(14px, -18px) rotate(8deg); }
  66%  { transform: translate(-10px, -30px) rotate(-6deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
.pearly-drift { animation: pearly-drift 16s ease-in-out infinite; }

/* Landing: feature card hover lift */
.pearly-card { transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease; }
.pearly-card:hover { transform: translateY(-6px); }

/* Respect reduced motion everywhere */
@media (prefers-reduced-motion: reduce) {
  .animated-gradient-bg,
  .pearly-float,
  .pearly-drift,
  .pearly-bob,
  .pearly-welcome-in,
  .pearly-msg-in,
  .pearly-pulse-ring::before {
    animation: none !important;
  }
  .pearly-card:hover { transform: none; }
}
```

- [ ] **Step 2: Create `components/landing/doodles.tsx`**

```tsx
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
```

- [ ] **Step 3: Verify build** — `pnpm build`, expected success.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css components/landing/doodles.tsx
git commit -m "feat: landing page keyframes and doodle components"
```

### Task A3: Landing page at `/`

**Files:**
- Modify: `app/page.tsx` (full rewrite — currently just renders `<ChatInterface />`)

**Interfaces:**
- Consumes: `Doodles` from Task A2; `/chat?q=` behavior from Task A1.

- [ ] **Step 1: Rewrite `app/page.tsx`** (server component, no `'use client'`):

```tsx
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
```

- [ ] **Step 2: Update metadata in `app/layout.tsx`** — change the title only:

```tsx
export const metadata: Metadata = {
  title: 'Pearly — Your Friendly Dental Health Guide',
  description: 'Learn dentistry with Pearly, your friendly AI dental education assistant',
```

(keep the `icons` block unchanged).

- [ ] **Step 3: Verify build** — `pnpm build`, expected success with `/` and `/chat` both listed.

- [ ] **Step 4: Manual check** — `pnpm dev`, open `http://localhost:3000`: hero, cards, pills, trust note, footer render; "Chat with Pearly" navigates to `/chat`; a topic pill navigates to `/chat?q=…` and the question auto-sends. Check dark mode by toggling OS/theme class.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/layout.tsx
git commit -m "feat: friendly landing page at / with hero, features, topic pills"
```

---

# TRACK B — Chat polish (branch `feat/chat-polish`)

**IMPORTANT for Track B:** another branch is concurrently adding an `initialQuestion` prop to `ChatInterface`'s signature and one small effect near the top of the component. Do NOT touch the component signature line, the `useChat` call, or add anything between the `useChat` call and the auth-session effect. Your edits are: the welcome-screen JSX, the header JSX, the sidebar, and extractions.

### Task B1: Shared language list

**Files:**
- Create: `lib/languages.ts`
- Modify: `components/chat-interface.tsx` (remove the `LANGUAGES` const, import it instead)

**Interfaces:**
- Produces: `export const LANGUAGES: { code: string; label: string }[]` from `lib/languages.ts`.

- [ ] **Step 1: Create `lib/languages.ts`** — move the existing array verbatim from `components/chat-interface.tsx` (lines ~34–48):

```ts
export const LANGUAGES = [
  { code: '', label: 'Auto-detect' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'fr-FR', label: 'French' },
  { code: 'de-DE', label: 'German' },
  { code: 'it-IT', label: 'Italian' },
  { code: 'pt-BR', label: 'Portuguese (BR)' },
  { code: 'zh-CN', label: 'Chinese (Mandarin)' },
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'ko-KR', label: 'Korean' },
  { code: 'ar-SA', label: 'Arabic' },
  { code: 'hi-IN', label: 'Hindi' },
]
```

- [ ] **Step 2:** In `components/chat-interface.tsx`, delete the `LANGUAGES` const and add `import { LANGUAGES } from '@/lib/languages'`.

- [ ] **Step 3: Verify build** — `pnpm build`, expected success.

- [ ] **Step 4: Commit** — `git add lib/languages.ts components/chat-interface.tsx && git commit -m "refactor: move language list to lib/languages"`

### Task B2: Settings popover + header cleanup

**Files:**
- Create: `components/chat-settings.tsx`
- Modify: `components/chat-interface.tsx` (header JSX ~lines 817–884, welcome-screen top-right controls ~lines 734–764, sidebar footer ~lines 598–615)

**Interfaces:**
- Consumes: `LANGUAGES` from Task B1; existing `Popover` components from `components/ui/popover.tsx`.
- Produces: `ChatSettings` component:

```tsx
type ChatSettingsProps = {
  language: string
  onLanguageChange: (lang: string) => void
  user: { email?: string } | null
  onSignOut: () => void
  /** styling variant: 'light' for the dark gradient welcome screen, 'default' for the chat header */
  variant?: 'default' | 'light'
}
```

- [ ] **Step 1: Create `components/chat-settings.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Settings, Sun, Moon, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LANGUAGES } from '@/lib/languages'

type ChatSettingsProps = {
  language: string
  onLanguageChange: (lang: string) => void
  user: { email?: string } | null
  onSignOut: () => void
  variant?: 'default' | 'light'
}

export default function ChatSettings({ language, onLanguageChange, user, onSignOut, variant = 'default' }: ChatSettingsProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Settings"
          className={cn(
            'p-2 rounded-xl transition-all',
            variant === 'light'
              ? 'text-white/70 hover:text-white hover:bg-white/15'
              : 'text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-700',
          )}
        >
          <Settings className="w-5 h-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 rounded-2xl p-4 space-y-4">
        <div>
          <label htmlFor="settings-lang" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
            Language
          </label>
          <select
            id="settings-lang"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed">
            Applies to voice input and text-to-speech
          </p>
        </div>

        {mounted && (
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex w-full items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        )}

        {user && (
          <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
            <p className="text-xs text-slate-400 dark:text-slate-500 truncate mb-1.5">{user.email}</p>
            <button
              type="button"
              onClick={onSignOut}
              className="flex items-center gap-2 text-sm font-semibold text-red-500 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Use it in the chat header** (`components/chat-interface.tsx`, chat view header): remove `{ThemeToggleBtn({})}` and the entire logged-in/logged-out block after it, and replace with:

```tsx
        <ChatSettings language={language} onLanguageChange={setLanguage} user={user} onSignOut={handleSignOut} />
        {!authLoading && !user && (
          <Button
            type="button"
            size="icon"
            onClick={() => setShowAuthModal(true)}
            title="Sign in"
            aria-label="Sign in"
            className="rounded-xl bg-transparent hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-300 shadow-none border-0"
          >
            <LogIn className="w-5 h-5" />
          </Button>
        )}
```

Keep the History, volume (TTS), and New Chat buttons exactly as they are. Add `import ChatSettings from '@/components/chat-settings'` at the top. Delete the now-unused `ThemeToggleBtn` sub-component and remove `Sun`, `Moon`, `LogOut` from the lucide import if no longer used.

- [ ] **Step 3: Use it on the welcome screen top-right** (replace the block that renders `{ThemeToggleBtn({ className: ... })}` and the auth controls):

```tsx
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
          <ChatSettings language={language} onLanguageChange={setLanguage} user={user} onSignOut={handleSignOut} variant="light" />
          {!authLoading && !user && (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white/80 hover:text-white bg-white/15 hover:bg-white/25 border border-white/20 hover:border-white/30 text-xs font-semibold transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
          )}
        </div>
```

- [ ] **Step 4: Remove the language select from the sidebar footer** — delete the whole `<div className="flex-shrink-0 border-t ...">` block at the bottom of `HistorySidebar` (the Language label, select, and helper text).

- [ ] **Step 5: Verify build** — `pnpm build`, expected success. Then `pnpm dev`: settings popover opens in both the welcome screen and chat view; language change persists; theme toggles; sign-out works when logged in.

- [ ] **Step 6: Commit** — `git add components/chat-settings.tsx components/chat-interface.tsx && git commit -m "feat: settings popover, decluttered chat header"`

### Task B3: Empty-state greeting speech bubble

**Files:**
- Modify: `app/globals.css` (INSERT a new block immediately after the `/* Typing dots */` section, mid-file — do NOT append at end of file, another branch is appending there)
- Modify: `components/chat-interface.tsx` (welcome screen JSX only)

- [ ] **Step 1: Insert into `app/globals.css`** right after the `.pearly-dot { ... }` rule:

```css
/* Welcome: gentle avatar bob */
@keyframes pearly-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-8px); }
}
.pearly-bob { animation: pearly-bob 3.2s ease-in-out infinite; }

/* Welcome: speech bubble tail */
.pearly-bubble::after {
  content: '';
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 9px solid transparent;
  border-right: 9px solid transparent;
  border-bottom: 9px solid rgba(255, 255, 255, 0.95);
}
.dark .pearly-bubble::after {
  border-bottom-color: rgba(30, 41, 59, 0.95);
}
```

- [ ] **Step 2: Update the welcome screen hero** in `components/chat-interface.tsx`. Replace the block from `<div className="relative mb-7 pearly-pulse-ring">` through the closing `</p>` after "Ask me anything about teeth, gums, and oral health." with:

```tsx
          <div className="pearly-bob relative mb-5">
            <div className="relative w-28 h-28 rounded-full overflow-hidden ring-4 ring-white/80 shadow-2xl">
              <Image src="/pearly.jpg" alt="Pearly the dental AI assistant" fill className="object-cover" priority />
            </div>
          </div>

          <div className="pearly-bubble relative bg-white/95 dark:bg-slate-800/95 rounded-2xl px-6 py-4 shadow-xl mb-8 max-w-xs text-center">
            <p className="text-lg font-extrabold text-slate-800 dark:text-slate-100">Hi! I&apos;m Pearly 🦷</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              What can I help you with today? Ask me anything about teeth, gums, and oral health.
            </p>
          </div>
```

(The `pearly-pulse-ring` class and the old `<h1>`/`<p>` are removed from this screen; leave the CSS rule in globals.css alone.)

- [ ] **Step 3: Verify build** — `pnpm build`; then `pnpm dev`: welcome screen shows bobbing Pearly with a speech bubble in light and dark modes.

- [ ] **Step 4: Commit** — `git add app/globals.css components/chat-interface.tsx && git commit -m "feat: greeting speech bubble and avatar bob on chat empty state"`

### Task B4: Extract HistorySidebar

**Files:**
- Create: `components/history-sidebar.tsx`
- Modify: `components/chat-interface.tsx` (delete the inline `HistorySidebar` sub-component; render the new one)

**Interfaces:**
- Produces: `components/history-sidebar.tsx` default-exports `HistorySidebar` and exports `type SavedConversation = { id: string; title: string; timestamp: number; messages: any[] }`. Props:

```tsx
type HistorySidebarProps = {
  chatHistory: SavedConversation[]
  showSignInPrompt: boolean
  onClose: () => void
  onNewChat: () => void
  onLoad: (conv: SavedConversation) => void
  onDelete: (id: string, e: React.MouseEvent) => void
  onSignIn: () => void
}
```

- [ ] **Step 1: Create `components/history-sidebar.tsx`** — move the JSX of the inline `HistorySidebar` (overlay + panel, minus the language footer removed in B2) plus the `timeAgo` helper and `SavedConversation` type verbatim, wiring the closures to the props above. It is a `'use client'` file importing `X, SquarePen, Trash2` from lucide-react. The full component:

```tsx
'use client'

import { X, SquarePen, Trash2 } from 'lucide-react'

export type SavedConversation = {
  id: string
  title: string
  timestamp: number
  messages: any[]
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

type HistorySidebarProps = {
  chatHistory: SavedConversation[]
  showSignInPrompt: boolean
  onClose: () => void
  onNewChat: () => void
  onLoad: (conv: SavedConversation) => void
  onDelete: (id: string, e: React.MouseEvent) => void
  onSignIn: () => void
}

export default function HistorySidebar({ chatHistory, showSignInPrompt, onClose, onNewChat, onLoad, onDelete, onSignIn }: HistorySidebarProps) {
  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed left-0 top-0 h-full w-72 bg-white dark:bg-slate-900 shadow-2xl z-40 flex flex-col border-r border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-700">
          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">Chat History</span>
          <button
            onClick={onClose}
            aria-label="Close history"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={onNewChat}
          className="flex items-center gap-2.5 mx-3 my-3 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm"
        >
          <SquarePen className="w-4 h-4" />
          New Chat
        </button>

        {showSignInPrompt && (
          <div className="mx-3 mb-2 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700">
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-1.5">
              Sign in to save your history across devices.
            </p>
            <button
              onClick={onSignIn}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Sign in or create account →
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {chatHistory.length === 0 ? (
            <p className="text-slate-400 dark:text-slate-500 text-xs text-center py-10 px-4 leading-relaxed">
              No saved conversations yet. Start chatting and your history will appear here.
            </p>
          ) : (
            <div className="space-y-0.5">
              {chatHistory.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => onLoad(conv)}
                  className="group w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-start gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-200 truncate leading-snug">{conv.title}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{timeAgo(conv.timestamp)}</p>
                  </div>
                  <button
                    onClick={(e) => onDelete(conv.id, e)}
                    aria-label="Delete conversation"
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 dark:text-slate-600 dark:hover:text-red-400 transition-all flex-shrink-0 mt-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Update `components/chat-interface.tsx`:**
  - Delete the inline `HistorySidebar` sub-component, the local `SavedConversation` type, and the local `timeAgo` helper.
  - Add `import HistorySidebar, { type SavedConversation } from '@/components/history-sidebar'`.
  - Replace both `{sidebarOpen && HistorySidebar()}` call sites with:

```tsx
      {sidebarOpen && (
        <HistorySidebar
          chatHistory={chatHistory}
          showSignInPrompt={!user && !authLoading}
          onClose={() => setSidebarOpen(false)}
          onNewChat={startNewChat}
          onLoad={loadConversation}
          onDelete={deleteConversation}
          onSignIn={() => { setSidebarOpen(false); setShowAuthModal(true) }}
        />
      )}
```

  - Clean up the lucide import: `History` and `X` are still used elsewhere (header history button, auth modal close) — keep them. Remove `SquarePen` and `Trash2` ONLY if no other usage remains (`SquarePen` is still used by the header's New Chat button — keep it). Verify each icon with a search before removing.

- [ ] **Step 3: Verify build** — `pnpm build`; then `pnpm dev`: open sidebar from both welcome and chat views, load/delete/new-chat all work, sign-in prompt appears when logged out.

- [ ] **Step 4: Commit** — `git add components/history-sidebar.tsx components/chat-interface.tsx && git commit -m "refactor: extract HistorySidebar into its own component"`

---

# INTEGRATION & FINAL VERIFICATION (orchestrator, after both branches complete)

- [ ] Check each branch's diff scope: `git diff --stat main feat/landing-page` (expect: app/chat/page.tsx, app/page.tsx, app/layout.tsx, app/globals.css, components/landing/doodles.tsx, components/chat-interface.tsx small) and `git diff --stat main feat/chat-polish` (expect: lib/languages.ts, components/chat-settings.tsx, components/history-sidebar.tsx, components/chat-interface.tsx, app/globals.css). Unrelated files → do not merge; cherry-pick the real files.
- [ ] Merge `feat/landing-page` into `main` first, then `feat/chat-polish`. Resolve any conflicts in `components/chat-interface.tsx` (keep both the `initialQuestion` addition and the polish edits) and `app/globals.css` (keep both CSS blocks).
- [ ] `pnpm build` on merged main — must pass.
- [ ] `pnpm dev` and verify end-to-end: landing renders (light + dark, ~390px and desktop widths); CTA → `/chat`; topic pill → auto-sent question; greeting bubble on empty chat; settings popover (language/theme/sign-out); sidebar (load/delete/new); voice mic + TTS buttons still present; login flow opens.
- [ ] Screenshot landing + chat in light and dark for the record.
- [ ] Push to origin (triggers Vercel deploy) only after all checks pass.
