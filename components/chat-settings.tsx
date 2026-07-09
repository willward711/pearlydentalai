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
