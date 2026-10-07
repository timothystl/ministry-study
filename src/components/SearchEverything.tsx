import { useMemo, useState, type FormEvent } from 'react'
import {
  BookOpen,
  Disc3,
  ExternalLink,
  FileText,
  HandHeart,
  Image,
  Lightbulb,
  Link2,
  Music,
  NotebookPen,
  ScrollText,
  Search,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { Library } from '../lib/model'
import { findAll, findScopes, type FindKind, type FindResult, type FindScope } from '../lib/find'

const icons: Record<FindKind, [LucideIcon, string]> = {
  sermon: [FileText, 'blue'],
  note: [NotebookPen, 'blue'],
  idea: [Lightbulb, 'amber'],
  children: [Users, 'amber'],
  prayer: [HandHeart, 'rose'],
  hymn: [Music, 'green'],
  liturgy: [ScrollText, 'green'],
  book: [BookOpen, 'blue'],
  resource: [Disc3, 'green'],
  visual: [Image, 'rose'],
  outside: [Link2, 'violet'],
  passage: [BookOpen, 'green'],
}
const examples = ['forgiveness', 'Luke 15:1–7', 'stewardship', 'lost sheep']

export function SearchEverything({
  library,
  onGo,
}: {
  library: Library
  onGo: (result: FindResult) => void
}) {
  const [input, setInput] = useState(''),
    [asked, setAsked] = useState(''),
    [scope, setScope] = useState<FindScope>('Everything')
  const results = useMemo(() => findAll(library, asked, scope), [library, asked, scope])
  function submit(e: FormEvent) {
    e.preventDefault()
    setAsked(input.trim())
  }
  return (
    <section className="sermons find-page" aria-label="What are you working on">
      <div className="sermons-head">
        <div>
          <h1>What are you working on?</h1>
          <p className="muted">
            Find books, sermons, children’s messages, Bible study notes, hymns and more.
          </p>
        </div>
      </div>
      <form className="bible-search" onSubmit={submit}>
        <div className="search-bar">
          <Search size={20} />
          <input
            aria-label="Search everything"
            placeholder="A topic, a passage, a title…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          {input && (
            <button
              type="button"
              className="icon-button"
              aria-label="Clear search"
              onClick={() => {
                setInput('')
                setAsked('')
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>
        <button type="submit" className="primary">
          Search
        </button>
      </form>
      <div className="find-scopes" role="group" aria-label="Where to look">
        {findScopes.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={scope === s}
            className={scope === s ? 'selected' : ''}
            onClick={() => setScope(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {!asked ? (
        <div className="find-empty">
          <p className="muted">Try one of these, or type your own.</p>
          <div className="find-scopes">
            {examples.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => {
                  setInput(x)
                  setAsked(x)
                }}
              >
                {x}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <p className="muted" role="status">
            {results.length} result{results.length === 1 ? '' : 's'} for “{asked}”
          </p>
          {!results.length && (
            <p className="muted">
              Nothing matched. Try fewer words, or search outside your own resources.
            </p>
          )}
          <ul className="find-results">
            {results.map((r) => {
              const [Icon, tone] = icons[r.kind]
              return (
                <li key={r.key} className="find-result">
                  <span className={`find-icon ${tone}`} aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <span className="find-text">
                    <strong>{r.title}</strong>
                    <span className="muted">{r.detail}</span>
                  </span>
                  {r.url ? (
                    <a
                      className="primary find-action"
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {r.action} <ExternalLink size={14} />
                    </a>
                  ) : (
                    <button type="button" className="primary find-action" onClick={() => onGo(r)}>
                      {r.action}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
      <blockquote className="find-verse">
        “Preach the word; be ready in season and out of season.”
        <cite>2 Timothy 4:2 (ESV)</cite>
      </blockquote>
    </section>
  )
}
