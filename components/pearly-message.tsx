'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Source = { label: string; url: string }

const SOURCES_LINE = /^\s*(?:sources?|references?)\s*:\s*(.*)$/i
const MD_LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g

// Labels the model uses for inline citations — rendered as pills, skipped in speech
const SOURCE_LABELS = ['ADA', 'CDC', 'NIH', 'MedlinePlus', 'Mayo Clinic', 'Cleveland Clinic', 'WHO', 'HRSA']
const CITATION_LINK = new RegExp(`\\*?\\s*\\[(?:${SOURCE_LABELS.join('|')})\\]\\([^)\\s]+\\)`, 'g')

function childText(children: unknown): string {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.filter((c) => typeof c === 'string').join('')
  return ''
}

// Split a trailing "Sources: [ADA](url), ..." line off the message body
export function splitSources(text: string): { body: string; sources: Source[] } {
  const lines = text.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (!line.trim()) continue
    const match = line.match(SOURCES_LINE)
    if (match) {
      const sources: Source[] = []
      for (const m of match[1].matchAll(MD_LINK)) {
        // Only http(s) URLs become clickable pills — blocks javascript: etc.
        if (/^https?:\/\//i.test(m[2])) sources.push({ label: m[1], url: m[2] })
      }
      const body = [...lines.slice(0, i), ...lines.slice(i + 1)].join('\n').trimEnd()
      return { body, sources }
    }
    break // last non-empty line isn't a sources line
  }
  return { body: text, sources: [] }
}

// Clean text before it's sent to text-to-speech: no markdown syntax,
// no URLs, no sources line, no emoji
export function stripForSpeech(text: string): string {
  const { body } = splitSources(text)
  return body
    .replace(CITATION_LINK, '') // drop inline citations entirely (don't speak "ADA")
    .replace(MD_LINK, '$1') // keep link text, drop URL
    .replace(/https?:\/\/\S+/g, '') // bare URLs
    .replace(/[a-z0-9.-]+\.(?:gov|org|com|edu|net)\/?\S*/gi, '') // bare domains like findahealthcenter.hrsa.gov
    .replace(/[*_#`~]/g, '') // markdown formatting characters
    .replace(/^\s*[-•]\s*/gm, '') // bullet markers
    .replace(/\p{Extended_Pictographic}/gu, '') // emoji
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function PearlyMessage({ text }: { text: string }) {
  const { body, sources } = splitSources(text)

  return (
    <div>
      <div className="pearly-prose space-y-2 [&_ul]:space-y-1 [&_ul]:pl-1 [&_ol]:space-y-1 [&_ol]:pl-5 [&_ol]:list-decimal">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="leading-relaxed">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            ul: ({ children }) => <ul>{children}</ul>,
            li: ({ children }) => (
              <li className="flex gap-2 leading-relaxed">
                <span className="text-blue-400 mt-0.5 flex-shrink-0" aria-hidden="true">•</span>
                <span>{children}</span>
              </li>
            ),
            a: ({ href, children }) => {
              const label = childText(children)
              // Inline citation links render as small source pills
              if (SOURCE_LABELS.includes(label) && href && /^https?:\/\//i.test(href)) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={hostLabel(href)}
                    className="inline-flex items-center gap-1 px-1.5 py-px ml-0.5 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[10px] font-medium text-slate-500 dark:text-slate-300 align-[2px] whitespace-nowrap hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-slate-100 transition-colors no-underline"
                  >
                    <span className="w-1 h-1 rounded-full bg-emerald-400 flex-shrink-0" aria-hidden="true" />
                    {label}
                  </a>
                )
              }
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 dark:text-blue-400 underline decoration-blue-300 dark:decoration-blue-600 underline-offset-2 hover:text-blue-600"
                >
                  {children}
                </a>
              )
            },
            h1: ({ children }) => <p className="text-lg font-bold mt-1">{children}</p>,
            h2: ({ children }) => <p className="text-base font-bold mt-1">{children}</p>,
            h3: ({ children }) => <p className="text-[15px] font-semibold mt-0.5">{children}</p>,
          }}
        >
          {body}
        </ReactMarkdown>
      </div>

      {sources.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {sources.map((s) => (
            <a
              key={s.url + s.label}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              title={hostLabel(s.url)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[11px] font-medium text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-slate-100 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" aria-hidden="true" />
              {s.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
