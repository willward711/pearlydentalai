'use client'

import { useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { Send, Sparkles } from 'lucide-react'
import Image from 'next/image'

const suggestedTopics = [
  {
    title: 'Tooth Anatomy',
    prompt: 'Can you explain the anatomy of a tooth in a fun and easy way?',
  },
  {
    title: 'Brushing Tips',
    prompt: 'What are the best brushing techniques for healthy teeth?',
  },
  {
    title: 'Cavity Prevention',
    prompt: 'How can I prevent cavities? Give me some helpful tips!',
  },
]

export default function ChatInterface() {
  const [input, setInput] = useState('')
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'
  const hasMessages = messages.length > 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput('')
  }

  const handleSuggestionClick = (prompt: string) => {
    if (isLoading) return
    sendMessage({ text: prompt })
  }

  return (
    <div className="flex flex-col h-screen animated-gradient-bg">
      {hasMessages ? (
        <>
          {/* Header - only when chatting */}
          <header className="flex items-center justify-center px-6 py-4 bg-white/90 backdrop-blur-sm border-b border-white/20">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-blue-200 shadow-md">
                <Image
                  src="/pearly.jpg"
                  alt="Pearly"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <h1 className="text-lg font-bold text-blue-900">Pearly</h1>
            </div>
          </header>

          {/* Messages Area */}
          <ScrollArea className="flex-1">
            <div className="max-w-2xl mx-auto px-4 py-6">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-3',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="relative flex-shrink-0 w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-md">
                        <Image
                          src="/pearly.jpg"
                          alt="Pearly"
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[75%] rounded-2xl px-4 py-3 shadow-md',
                        message.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-md'
                          : 'bg-white border border-blue-100 rounded-bl-md'
                      )}
                    >
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.parts.map((part, index) => {
                          if (part.type === 'text') {
                            return <span key={index}>{part.text}</span>
                          }
                          return null
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                  <div className="flex gap-3 justify-start">
                    <div className="relative flex-shrink-0 w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-md">
                      <Image
                        src="/pearly.jpg"
                        alt="Pearly"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="bg-white border border-blue-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-md">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          {/* Chat Input */}
          <div className="bg-white/90 backdrop-blur-sm border-t border-white/20">
            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-4">
              <div className="flex items-end gap-3">
                <div className="relative flex-shrink-0 w-10 h-10 rounded-full overflow-hidden border-2 border-blue-200 shadow-md">
                  <Image
                    src="/pearly.jpg"
                    alt="Pearly"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 relative flex items-end gap-2 p-2 rounded-2xl bg-white border border-blue-200 focus-within:ring-2 focus-within:ring-blue-300 focus-within:border-blue-400 transition-all shadow-sm">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask Pearly anything..."
                    disabled={isLoading}
                    rows={1}
                    className="flex-1 min-h-[44px] max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-gray-800 placeholder:text-gray-400"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSubmit(e)
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || isLoading}
                    className="flex-shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                  >
                    {isLoading ? (
                      <Sparkles className="w-4 h-4 animate-pulse" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </>
      ) : (
        /* Welcome Screen - Centered */
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* Pearly Avatar */}
          <div className="relative w-28 h-28 mb-6 rounded-full overflow-hidden border-4 border-white shadow-2xl">
            <Image
              src="/pearly.jpg"
              alt="Pearly"
              fill
              className="object-cover"
              priority
            />
          </div>
          
          {/* Greeting */}
          <h1 className="text-3xl font-bold text-white mb-6 text-center drop-shadow-lg">
            Hi, I&apos;m Pearly!
          </h1>
          
          {/* Topic suggestions */}
          <p className="text-white/90 text-sm font-medium mb-4 drop-shadow">
            Try asking me about:
          </p>
          
          <div className="flex flex-wrap justify-center gap-3 mb-8 max-w-md">
            {suggestedTopics.map((topic) => (
              <button
                key={topic.title}
                onClick={() => handleSuggestionClick(topic.prompt)}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium rounded-full bg-white/95 text-blue-700 hover:bg-white hover:scale-105 transition-all shadow-lg disabled:opacity-50 border border-white/50"
              >
                {topic.title}
              </button>
            ))}
          </div>
          
          {/* Search Bar */}
          <form onSubmit={handleSubmit} className="w-full max-w-lg">
            <div className="flex items-center gap-2 p-2 rounded-2xl bg-white/95 backdrop-blur-sm border border-white/50 shadow-xl">
              <div className="relative flex-shrink-0 w-10 h-10 rounded-full overflow-hidden border-2 border-blue-200">
                <Image
                  src="/pearly.jpg"
                  alt="Pearly"
                  fill
                  className="object-cover"
                />
              </div>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Pearly anything about dental health..."
                disabled={isLoading}
                rows={1}
                className="flex-1 min-h-[44px] max-h-[44px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-gray-800 placeholder:text-gray-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="flex-shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md"
              >
                {isLoading ? (
                  <Sparkles className="w-4 h-4 animate-pulse" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </form>
          
          {/* Disclaimer */}
          <p className="mt-4 text-xs text-white/70 text-center max-w-md drop-shadow">
            Pearly is not a substitute for professional dental advice. Please consult your dentist for personalized care.
          </p>
        </div>
      )}
    </div>
  )
}
