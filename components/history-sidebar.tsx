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
