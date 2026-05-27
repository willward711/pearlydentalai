'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Send, Sparkles, ChevronDown, Mic, MicOff, Volume2, VolumeX, Sun, Moon, SquarePen, History, X, Trash2, LogIn, LogOut } from 'lucide-react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

type SavedConversation = {
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

const HISTORY_KEY = 'pearly_chat_history'
const LANG_KEY = 'pearly_lang'

const LANGUAGES = [
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

const suggestedTopics = [
  {
    title: 'Tooth Anatomy',
    icon: '🦷',
    prompt: 'Can you explain the anatomy of a tooth in a fun and easy way?',
  },
  {
    title: 'Brushing Tips',
    icon: '🪥',
    prompt: 'What are the best brushing techniques for healthy teeth?',
  },
  {
    title: 'Cavity Prevention',
    icon: '🛡️',
    prompt: 'How can I prevent cavities? Give me some helpful tips!',
  },
  {
    title: 'Flossing Guide',
    icon: '🧵',
    prompt: 'What is the correct way to floss, and why does it matter?',
  },
  {
    title: 'Foods for Teeth',
    icon: '🥦',
    prompt: 'Which foods are best and worst for my teeth?',
  },
]

function PearlyAvatar({ size = 'sm', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dims = size === 'lg' ? 'w-28 h-28' : size === 'md' ? 'w-11 h-11' : 'w-9 h-9'
  return (
    <div className={cn('relative flex-shrink-0 rounded-full overflow-hidden ring-2 ring-white shadow-md', dims, className)}>
      <Image src="/pearly.jpg" alt="Pearly" fill className="object-cover" priority />
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5 pearly-msg-in">
      <PearlyAvatar size="sm" />
      <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-bl-sm px-4 py-3.5 shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="pearly-dot block w-2 h-2 rounded-full bg-blue-400"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ChatInterface() {
  const [input, setInput] = useState('')
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [ttsSupported, setTtsSupported] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [chatHistory, setChatHistory] = useState<SavedConversation[]>([])
  const [language, setLanguage] = useState('')

  // Auth state
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)

  const currentSessionIdRef = useRef<string | null>(null)

  const { theme, setTheme } = useTheme()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)
  const lastSpokenMessageIdRef = useRef<string | null>(null)

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'
  const hasMessages = messages.length > 0

  useEffect(() => setMounted(true), [])

  // Auth: listen for session changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load chat history and language from localStorage on mount (guests)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      if (stored) setChatHistory(JSON.parse(stored))
      const savedLang = localStorage.getItem(LANG_KEY)
      if (savedLang !== null) setLanguage(savedLang)
    } catch {}
  }, [])

  // Persist language preference
  useEffect(() => {
    try { localStorage.setItem(LANG_KEY, language) } catch {}
  }, [language])

  // Detect browser speech support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) setSpeechSupported(true)
    if ('speechSynthesis' in window) setTtsSupported(true)
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Supabase: load history when user logs in
  const loadSupabaseHistory = useCallback(async () => {
    const { data } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at, messages')
      .order('updated_at', { ascending: false })
      .limit(50)
    if (data) {
      setChatHistory(
        data.map((s: any) => ({
          id: s.id,
          title: s.title,
          timestamp: new Date(s.created_at).getTime(),
          messages: s.messages,
        })),
      )
    }
  }, [])

  useEffect(() => {
    if (user) {
      loadSupabaseHistory()
    } else if (!authLoading) {
      try {
        const stored = localStorage.getItem(HISTORY_KEY)
        setChatHistory(stored ? JSON.parse(stored) : [])
      } catch {}
    }
  }, [user, authLoading, loadSupabaseHistory])

  // Supabase: auto-save when a full exchange (user → assistant) completes
  useEffect(() => {
    if (!user || isLoading || messages.length === 0) return
    const lastMsg = messages[messages.length - 1]
    if (lastMsg?.role !== 'assistant') return

    const save = async () => {
      const firstUser = messages.find((m: any) => m.role === 'user')
      if (!firstUser) return
      const title = firstUser.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join(' ')
        .slice(0, 50)

      if (!currentSessionIdRef.current) {
        const { data } = await supabase
          .from('chat_sessions')
          .insert({ user_id: user.id, title, messages })
          .select('id')
          .single()
        if (data) currentSessionIdRef.current = data.id
      } else {
        await supabase
          .from('chat_sessions')
          .update({ messages })
          .eq('id', currentSessionIdRef.current)
      }
      loadSupabaseHistory()
    }

    save()
  }, [messages, isLoading, user, loadSupabaseHistory])

  const saveCurrentConversation = useCallback((currentMessages: any[]) => {
    if (user || currentMessages.length === 0) return
    const firstUserMsg = currentMessages.find((m: any) => m.role === 'user')
    if (!firstUserMsg) return
    const title = firstUserMsg.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join(' ')
      .slice(0, 50)
    const conv: SavedConversation = {
      id: Date.now().toString(),
      title,
      timestamp: Date.now(),
      messages: currentMessages,
    }
    setChatHistory((prev) => {
      const updated = [conv, ...prev].slice(0, 50)
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)) } catch {}
      return updated
    })
  }, [user])

  const loadConversation = useCallback((conv: SavedConversation) => {
    window.speechSynthesis?.cancel()
    setMessages(conv.messages)
    currentSessionIdRef.current = user ? conv.id : null
    setSidebarOpen(false)
  }, [setMessages, user])

  const deleteConversation = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (user) {
      await supabase.from('chat_sessions').delete().eq('id', id)
    }
    setChatHistory((prev) => {
      const updated = prev.filter((c) => c.id !== id)
      if (!user) {
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)) } catch {}
      }
      return updated
    })
  }, [user])

  const startNewChat = useCallback(() => {
    saveCurrentConversation(messages)
    window.speechSynthesis?.cancel()
    setMessages([])
    currentSessionIdRef.current = null
    setSidebarOpen(false)
  }, [messages, saveCurrentConversation, setMessages])

  // Auth handlers
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthSubmitting(true)
    setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
    if (error) setAuthError(error.message)
    else {
      setShowAuthModal(false)
      setAuthEmail('')
      setAuthPassword('')
    }
    setAuthSubmitting(false)
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthSubmitting(true)
    setAuthError('')
    const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword })
    if (error) setAuthError(error.message)
    else setSignupSuccess(true)
    setAuthSubmitting(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    currentSessionIdRef.current = null
    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      setChatHistory(stored ? JSON.parse(stored) : [])
    } catch {
      setChatHistory([])
    }
  }

  // TTS helpers
  const speak = useCallback((text: string) => {
    if (!ttsSupported) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    if (language) utterance.lang = language
    window.speechSynthesis.speak(utterance)
  }, [ttsSupported, language])

  useEffect(() => {
    if (!ttsEnabled || !ttsSupported || isLoading) return
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== 'assistant') return
    if (lastMessage.id === lastSpokenMessageIdRef.current) return
    const text = lastMessage.parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as any).text)
      .join(' ')
    if (!text.trim()) return
    lastSpokenMessageIdRef.current = lastMessage.id
    speak(text)
  }, [messages, isLoading, ttsEnabled, ttsSupported, speak])

  // Voice input
  const startListening = useCallback(() => {
    if (!speechSupported || isListening) return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = language || navigator.language || 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setInput(transcript)
      setIsListening(false)
      setTimeout(() => {
        if (transcript.trim()) {
          sendMessage({ text: transcript })
          setInput('')
        }
      }, 100)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [speechSupported, isListening, sendMessage, language])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  const handleScroll = () => {
    const el = scrollContainerRef.current
    if (!el) return
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120)
  }

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }
  }

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleSuggestionClick = (prompt: string) => {
    if (isLoading) return
    sendMessage({ text: prompt })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // ── Sub-components called as functions (not as JSX) to prevent remount on each render ──

  const ThemeToggleBtn = ({ className }: { className?: string }) => {
    if (!mounted) return <div className={cn('w-9 h-9', className)} />
    return (
      <Button
        type="button"
        size="icon"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className={cn(
          'rounded-xl bg-transparent hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-300 shadow-none border-0',
          className,
        )}
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </Button>
    )
  }

  const MicButton = () => (
    <>
      {speechSupported && (
        <Button
          type="button"
          size="icon"
          onClick={isListening ? stopListening : startListening}
          disabled={isLoading}
          aria-label={isListening ? 'Stop listening' : 'Start voice input'}
          aria-pressed={isListening}
          className={cn(
            'flex-shrink-0 rounded-xl w-9 h-9 shadow-sm transition-all duration-200',
            isListening
              ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400',
          )}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>
      )}
    </>
  )

  const InputBar = ({ compact = false }: { compact?: boolean }) => (
    <form
      onSubmit={handleSubmit}
      aria-label="Chat with Pearly"
      className={cn('w-full', compact ? 'max-w-2xl mx-auto px-4 pb-4 pt-2' : 'max-w-xl w-full')}
    >
      <div className="pearly-input-wrap flex items-end gap-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg transition-shadow duration-200 px-3 py-2.5">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={compact ? 'Message Pearly…' : 'Ask Pearly anything about dental health…'}
          disabled={isLoading}
          rows={1}
          aria-label="Message input"
          className="flex-1 resize-none bg-transparent border-0 outline-none ring-0 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm leading-relaxed min-h-[40px] max-h-[120px] py-1 disabled:opacity-60"
          style={{ height: '40px' }}
        />
        {MicButton()}
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isLoading}
          aria-label={isLoading ? 'Sending…' : 'Send message'}
          className={cn(
            'flex-shrink-0 rounded-xl w-9 h-9 transition-all duration-200 shadow-sm',
            input.trim() && !isLoading
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600',
          )}
        >
          {isLoading ? <Sparkles className="w-4 h-4 animate-pulse" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </form>
  )

  const HistorySidebar = () => (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 transition-opacity"
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
      <div className="fixed left-0 top-0 h-full w-72 bg-white dark:bg-slate-900 shadow-2xl z-40 flex flex-col border-r border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-700">
          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">Chat History</span>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close history"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={startNewChat}
          className="flex items-center gap-2.5 mx-3 my-3 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm"
        >
          <SquarePen className="w-4 h-4" />
          New Chat
        </button>

        {!user && !authLoading && (
          <div className="mx-3 mb-2 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700">
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-1.5">
              Sign in to save your history across devices.
            </p>
            <button
              onClick={() => { setSidebarOpen(false); setShowAuthModal(true) }}
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
                  onClick={() => loadConversation(conv)}
                  className="group w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-start gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-200 truncate leading-snug">{conv.title}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{timeAgo(conv.timestamp)}</p>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
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

        <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 px-4 py-3">
          <label htmlFor="lang-select" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
            Language
          </label>
          <select
            id="lang-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
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
      </div>
    </>
  )

  const AuthModal = () => (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => { setShowAuthModal(false); setSignupSuccess(false); setAuthError('') }}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {signupSuccess ? 'Check your email!' : authMode === 'signin' ? 'Welcome back' : 'Create account'}
            </h2>
            {!signupSuccess && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {authMode === 'signin' ? 'Sign in to save your chat history.' : 'Join to save your dental learning journey.'}
              </p>
            )}
          </div>
          <button
            onClick={() => { setShowAuthModal(false); setSignupSuccess(false); setAuthError('') }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {signupSuccess ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">📧</div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              We sent a confirmation link to <strong>{authEmail}</strong>. Click it to activate your account.
            </p>
            <button
              onClick={() => { setSignupSuccess(false); setAuthMode('signin') }}
              className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={authMode === 'signin' ? handleSignIn : handleSignUp} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Password</label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-slate-400"
              />
            </div>
            {authError && (
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{authError}</p>
            )}
            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {authSubmitting ? '…' : authMode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
            <p className="text-center text-xs text-slate-500 dark:text-slate-400 pt-1">
              {authMode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setAuthError('') }}
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                {authMode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  )

  // ── Welcome screen ──────────────────────────────────────────────────────────

  if (!hasMessages) {
    return (
      <div className="flex flex-col h-screen animated-gradient-bg overflow-hidden">
        <div aria-live="assertive" aria-atomic="true" className="sr-only">
          {isListening ? 'Listening for your voice input' : ''}
        </div>

        {sidebarOpen && HistorySidebar()}
        {showAuthModal && AuthModal()}

        <div className="absolute top-3 left-3 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open chat history"
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/15 transition-all"
          >
            <History className="w-5 h-5" />
          </button>
        </div>

        <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
          {ThemeToggleBtn({ className: 'text-white/70 hover:text-white hover:bg-white/15 dark:hover:bg-white/15' })}
          {!authLoading && (
            user ? (
              <div className="flex items-center gap-1">
                <div
                  className="w-7 h-7 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white text-xs font-bold"
                  title={user.email}
                >
                  {user.email?.[0].toUpperCase()}
                </div>
                <button
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  title="Sign out"
                  className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/15 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white/80 hover:text-white bg-white/15 hover:bg-white/25 border border-white/20 hover:border-white/30 text-xs font-semibold transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </button>
            )
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pearly-welcome-in">
          <div className="relative mb-7 pearly-pulse-ring">
            <div className="relative w-28 h-28 rounded-full overflow-hidden ring-4 ring-white/80 shadow-2xl">
              <Image src="/pearly.jpg" alt="Pearly the dental AI assistant" fill className="object-cover" priority />
            </div>
          </div>

          <h1 className="text-4xl font-extrabold text-white text-center leading-tight mb-2 drop-shadow-md">
            Hi, I&apos;m Pearly!
          </h1>
          <p className="text-white/80 text-base text-center mb-8 max-w-xs leading-relaxed">
            Your friendly guide to all things dental. Ask me anything about teeth, gums, and oral health.
          </p>

          <div className="flex flex-wrap justify-center gap-2.5 max-w-md mb-10">
            {suggestedTopics.map((topic) => (
              <button
                key={topic.title}
                onClick={() => handleSuggestionClick(topic.prompt)}
                disabled={isLoading}
                aria-label={`Ask about ${topic.title}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-white/15 text-white border border-white/25 backdrop-blur-sm hover:bg-white/25 hover:border-white/40 hover:scale-105 transition-all duration-150 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-40 disabled:pointer-events-none"
              >
                <span aria-hidden="true">{topic.icon}</span>
                {topic.title}
              </button>
            ))}
          </div>

          {InputBar({ compact: false })}

          <p className="mt-5 text-xs text-white/55 text-center max-w-sm leading-relaxed">
            For educational purposes only — not a substitute for professional dental advice.
          </p>
        </div>
      </div>
    )
  }

  // ── Chat view ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen pearly-chat-bg">
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {isListening ? 'Listening for your voice input' : ''}
      </div>

      {sidebarOpen && HistorySidebar()}
      {showAuthModal && AuthModal()}

      {/* Header */}
      <header className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700/80 shadow-sm z-10">
        <Button
          type="button"
          size="icon"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open chat history"
          className="rounded-xl bg-transparent hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-300 shadow-none border-0 -ml-1"
        >
          <History className="w-5 h-5" />
        </Button>
        <PearlyAvatar size="sm" />
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-none">Pearly</p>
          <p className="text-xs text-emerald-500 font-medium mt-0.5 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Online
          </p>
        </div>
        {ttsSupported && (
          <Button
            type="button"
            size="icon"
            onClick={() => {
              if (ttsEnabled) window.speechSynthesis.cancel()
              setTtsEnabled((prev) => !prev)
            }}
            aria-label={ttsEnabled ? 'Mute Pearly voice' : 'Unmute Pearly voice'}
            aria-pressed={ttsEnabled}
            className="rounded-xl bg-transparent hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-300 shadow-none border-0"
          >
            {ttsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          onClick={startNewChat}
          aria-label="Start new chat"
          title="New chat"
          className="rounded-xl bg-transparent hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-300 shadow-none border-0"
        >
          <SquarePen className="w-5 h-5" />
        </Button>
        {ThemeToggleBtn({})}
        {!authLoading && (
          user ? (
            <button
              onClick={handleSignOut}
              title={`Sign out (${user.email})`}
              aria-label="Sign out"
              className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white text-xs font-bold transition-colors shadow-sm"
            >
              {user.email?.[0].toUpperCase()}
            </button>
          ) : (
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
          )
        )}
      </header>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Conversation with Pearly"
      >
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
          {messages.map((message, index) => {
            const isUser = message.role === 'user'
            const messageText = message.parts
              .filter((p) => p.type === 'text')
              .map((p) => (p as any).text)
              .join(' ')
            return (
              <div
                key={message.id}
                className={cn('flex items-end gap-2.5 pearly-msg-in', isUser ? 'justify-end' : 'justify-start')}
                style={{ animationDelay: `${Math.min(index * 0.04, 0.2)}s` }}
              >
                {!isUser && <PearlyAvatar size="sm" />}

                <div
                  className={cn(
                    'max-w-[75%] px-4 py-3 text-sm leading-relaxed',
                    isUser
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-br-sm shadow-md shadow-blue-200/50'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-bl-sm shadow-sm border border-slate-100 dark:border-slate-700',
                  )}
                >
                  <div className="whitespace-pre-wrap">
                    {message.parts.map((part, i) => {
                      if (part.type === 'text') return <span key={i}>{(part as any).text}</span>
                      return null
                    })}
                  </div>
                  {!isUser && ttsSupported && (
                    <button
                      type="button"
                      onClick={() => speak(messageText)}
                      aria-label="Replay this message aloud"
                      className="mt-1.5 text-blue-300 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded transition-colors"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isUser && (
                  <div
                    className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md"
                    aria-hidden="true"
                  >
                    <span className="text-white text-xs font-bold leading-none">You</span>
                  </div>
                )}
              </div>
            )
          })}

          {isLoading && messages[messages.length - 1]?.role === 'user' && <TypingIndicator />}
          <div ref={messagesEndRef} aria-hidden="true" />
        </div>
      </div>

      {/* Scroll-to-bottom button */}
      {showScrollBtn && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={scrollToBottom}
            aria-label="Scroll to latest message"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-150"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            Latest
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="flex-shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-700/80">
        {InputBar({ compact: true })}
        <p className="pb-3 text-center text-xs text-slate-400 dark:text-slate-500 px-4">
          For education only — not professional dental advice
        </p>
      </div>
    </div>
  )
}
