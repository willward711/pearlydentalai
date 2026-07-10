'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Send, Sparkles, ChevronDown, Mic, MicOff, Volume2, VolumeX, SquarePen, History, X, LogIn } from 'lucide-react'
import ChatSettings from '@/components/chat-settings'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { LANGUAGES } from '@/lib/languages'
import HistorySidebar, { type SavedConversation } from '@/components/history-sidebar'
import PearlyMessage, { stripForSpeech } from '@/components/pearly-message'

const HISTORY_KEY = 'pearly_chat_history'
const LANG_KEY = 'pearly_lang'

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

export default function ChatInterface({ initialQuestion }: { initialQuestion?: string }) {
  const [input, setInput] = useState('')
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(false)
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

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)
  const lastSpokenMessageIdRef = useRef<string | null>(null)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'
  const hasMessages = messages.length > 0

  useEffect(() => setMounted(true), [])

  // Auto-send a question passed via /chat?q= (from landing page topic pills)
  const initialSentRef = useRef(false)
  useEffect(() => {
    if (!initialQuestion?.trim() || initialSentRef.current) return
    initialSentRef.current = true
    sendMessage({ text: initialQuestion })
  }, [initialQuestion, sendMessage])

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
    // OpenAI TTS plays through an <audio> element, which every browser supports
    setTtsSupported(true)
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

  // Stop any speech currently playing (OpenAI audio or browser fallback)
  const stopSpeaking = useCallback(() => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
      ttsAudioRef.current = null
    }
    window.speechSynthesis?.cancel()
  }, [])

  const loadConversation = useCallback((conv: SavedConversation) => {
    stopSpeaking()
    setMessages(conv.messages)
    currentSessionIdRef.current = user ? conv.id : null
    setSidebarOpen(false)
  }, [setMessages, user, stopSpeaking])

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
    stopSpeaking()
    setMessages([])
    currentSessionIdRef.current = null
    setSidebarOpen(false)
  }, [messages, saveCurrentConversation, setMessages, stopSpeaking])

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

  // TTS helpers — browser speech is the fallback when OpenAI TTS fails
  const speakWithBrowser = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return
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
    window.speechSynthesis.speak(utterance)
  }, [language])

  const speak = useCallback(async (rawText: string) => {
    stopSpeaking()
    // Strip markdown, URLs, and the sources line so the voice reads clean prose
    const text = stripForSpeech(rawText)
    if (!text) return
    // Pointing the audio element at the URL lets the browser start playing
    // while OpenAI is still generating the rest of the clip
    const audio = new Audio('/api/tts?text=' + encodeURIComponent(text.slice(0, 4000)))
    audio.preload = 'auto'
    ttsAudioRef.current = audio

    let fellBack = false
    const fallback = () => {
      if (fellBack) return
      fellBack = true
      if (ttsAudioRef.current === audio) ttsAudioRef.current = null
      speakWithBrowser(text)
    }
    audio.onerror = fallback
    audio.onended = () => {
      if (ttsAudioRef.current === audio) ttsAudioRef.current = null
    }
    try {
      await audio.play()
    } catch {
      fallback()
    }
  }, [stopSpeaking, speakWithBrowser])

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

  // Stop audio if the user navigates away from the chat
  useEffect(() => () => stopSpeaking(), [stopSpeaking])

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

        <div className="flex-1 flex flex-col items-center justify-center px-6 pearly-welcome-in">
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
            Pearly is an AI and can make mistakes. For educational purposes only — not a substitute for
            professional dental advice, diagnosis, or treatment.
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
              if (ttsEnabled) stopSpeaking()
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
                  {isUser ? (
                    <div className="whitespace-pre-wrap">{messageText}</div>
                  ) : (
                    <PearlyMessage text={messageText} />
                  )}
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
          Pearly is an AI and can make mistakes — for education only, not professional advice, diagnosis, or
          treatment. In an emergency, call 911.
        </p>
      </div>
    </div>
  )
}
