import { useMemo, useState, type FormEvent } from 'react'
import { BookOpen, ExternalLink, Music, Search } from 'lucide-react'
import { PassageReader } from './BibleStudy'
import type { Book, Library } from '../lib/model'
import {
  materialFor,
  observationKinds,
  observationLabel,
  observationsFor,
  saveObservation,
  type ObservationKind,
} from '../lib/research'
import { sortSermons } from '../lib/sermons'

const tabs = ['Passage', 'My material', 'Commentary', 'Teaching', 'Hymns & music'] as const
type Tab = (typeof tabs)[number]

function BookList({
  books,
  onOpen,
  empty,
}: {
  books: Book[]
  onOpen: (b: Book) => void
  empty: string
}) {
  if (!books.length) return <p className="muted">{empty}</p>
  return (
    <ul className="research-list">
      {books.slice(0, 60).map((b) => (
        <li key={b.id}>
          <button type="button" className="link" onClick={() => onOpen(b)}>
            {b.title}
          </button>
          <span className="muted">
            {[b.author, b.ownership === 'Owned' ? 'Owned' : b.ownership]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Observations({
  library,
  passage,
  onSave,
}: {
  library: Library
  passage: string
  onSave: (next: Library) => boolean | void
}) {
  const saved = observationsFor(library, passage)
  const sermons = sortSermons(library.sermons).slice(0, 200)
  const blank = {
    id: '',
    kind: 'Sermon note' as ObservationKind,
    title: '',
    body: '',
    sermonId: '',
  }
  const [draft, setDraft] = useState(blank),
    [error, setError] = useState(''),
    [done, setDone] = useState('')
  function save(e: FormEvent) {
    e.preventDefault()
    try {
      const next = saveObservation(library, { ...draft, id: draft.id || undefined }, passage)
      if (onSave(next) === false) return
      setDraft(blank)
      setError('')
      setDone('Saved.')
    } catch (err) {
      setDone('')
      setError((err as Error).message)
    }
  }
  return (
    <section className="research-observations" aria-label="My observations">
      <h2>My observations</h2>
      <form onSubmit={save}>
        <div className="research-kind" role="radiogroup" aria-label="Notes for">
          {observationKinds.map((k) => (
            <label key={k}>
              <input
                type="radio"
                name="observation-kind"
                checked={draft.kind === k}
                onChange={() => setDraft({ ...draft, kind: k })}
              />
              {observationLabel(k)} notes
            </label>
          ))}
        </div>
        <label>
          Title (optional)
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
        <label>
          Notes
          <textarea
            rows={7}
            placeholder="Write your notes, thoughts, questions …"
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
        </label>
        {!!sermons.length && (
          <label>
            Tie to a sermon (optional)
            <select
              value={draft.sermonId}
              onChange={(e) => setDraft({ ...draft, sermonId: e.target.value })}
            >
              <option value="">None</option>
              {sermons.map((s) => (
                <option key={s.id} value={s.id}>
                  {[s.date.slice(0, 4), s.title].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {done && (
          <p className="muted" role="status">
            {done}
          </p>
        )}
        <div className="sermon-actions">
          <button type="submit" className="primary">
            {draft.id ? 'Update notes' : 'Save notes'}
          </button>
          {draft.id && (
            <button type="button" onClick={() => setDraft(blank)}>
              New notes
            </button>
          )}
        </div>
      </form>
      {!!saved.length && (
        <>
          <h3>Saved on this passage</h3>
          <ul className="research-list">
            {saved.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className="link"
                  onClick={() =>
                    setDraft({
                      id: n.id,
                      kind: n.kind as ObservationKind,
                      title: n.title,
                      body: n.body,
                      sermonId: n.sermonId,
                    })
                  }
                >
                  {n.title}
                </button>
                <span className="muted">
                  {observationLabel(n.kind)} · {n.scripture}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export function ResearchText({
  library,
  onSave,
  canWriteNotes,
  onOpenBook,
  onOpenHymn,
  startPassage = '',
}: {
  library: Library
  onSave: (next: Library) => boolean | void
  canWriteNotes: boolean
  onOpenBook: (b: Book) => void
  onOpenHymn: (id: string) => void
  startPassage?: string
}) {
  const [input, setInput] = useState(startPassage || 'Luke 15:1–7'),
    [asked, setAsked] = useState(startPassage),
    [reload, setReload] = useState(0),
    [tab, setTab] = useState<Tab>('Passage')
  const material = useMemo(() => materialFor(library, asked), [library, asked])
  function submit(e: FormEvent) {
    e.preventDefault()
    setAsked(input.trim())
    setReload((n) => n + 1)
  }
  const start = [
    ...material.sermons.slice(0, 3).map((s) => ({
      id: s.id,
      title: s.title,
      note: ['Sermon', s.date].filter(Boolean).join(' · '),
    })),
    ...material.notes.slice(0, 3).map((n) => ({
      id: n.id,
      title: n.title,
      note: [n.kind, n.date].filter(Boolean).join(' · '),
    })),
  ]
  const web = `https://www.google.com/search?q=${encodeURIComponent(`${asked} commentary sermon`)}`
  return (
    <section className="sermons research-text">
      <div className="sermons-head">
        <div>
          <h1>Research a Text</h1>
          <p className="muted">Dig into Scripture with your resources, notes and trusted tools.</p>
        </div>
      </div>
      <form className="bible-search" onSubmit={submit}>
        <div className="search-bar">
          <Search size={20} />
          <input
            aria-label="Passage"
            placeholder="Luke 15:1–7, Psalm 23, Romans 8…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <button type="submit" className="primary">
          Open passage
        </button>
      </form>
      {!asked ? (
        <p className="muted">
          Enter a passage to see the text in the original languages and English, and everything you
          already have on it.
        </p>
      ) : (
        <div className="research-layout">
          <div className="research-main">
            <div className="tabs" role="tablist" aria-label="Research">
              {tabs.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  className={tab === t ? 'selected' : ''}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div role="tabpanel" aria-label={tab}>
              {tab === 'Passage' && (
                <>
                  <PassageReader key={`${asked}|${reload}`} asked={asked} reload={reload} />
                  {canWriteNotes ? (
                    <Observations library={library} passage={asked} onSave={onSave} />
                  ) : (
                    <p className="muted">Notes aren’t turned on for you yet.</p>
                  )}
                </>
              )}
              {tab === 'My material' && (
                <>
                  <h2>Sermons on this passage</h2>
                  {material.sermons.length ? (
                    <ul className="research-list">
                      {material.sermons.map((s) => (
                        <li key={s.id}>
                          <strong>{s.title}</strong>
                          <span className="muted">
                            {[s.date, s.series, s.scripture].filter(Boolean).join(' · ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">
                      None yet. Funeral and wedding sermons are left out of this list.
                    </p>
                  )}
                  <h2>Notes, illustrations and ideas</h2>
                  {material.notes.length ? (
                    <ul className="research-list">
                      {material.notes.map((n) => (
                        <li key={n.id}>
                          <strong>{n.title}</strong>
                          <span className="muted">
                            {[n.kind, n.date, n.scripture].filter(Boolean).join(' · ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Nothing saved on this passage yet.</p>
                  )}
                </>
              )}
              {tab === 'Commentary' && (
                <>
                  <h2>Commentaries in your library</h2>
                  <BookList
                    books={material.commentaries}
                    onOpen={onOpenBook}
                    empty="No commentary in your library mentions this book of the Bible yet."
                  />
                </>
              )}
              {tab === 'Teaching' && (
                <>
                  <h2>Books and studies on this book of the Bible</h2>
                  <BookList
                    books={material.teaching}
                    onOpen={onOpenBook}
                    empty="No other books in your library mention this book of the Bible yet."
                  />
                </>
              )}
              {tab === 'Hymns & music' && (
                <>
                  <h2>Hymns tied to this passage</h2>
                  {material.hymns.length ? (
                    <ul className="research-list">
                      {material.hymns.map((h) => (
                        <li key={h.id}>
                          <button type="button" className="link" onClick={() => onOpenHymn(h.id)}>
                            {h.title}
                          </button>
                          <span className="muted">
                            {[h.hymnal, h.tune].filter(Boolean).join(' · ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No hymn in your catalog names this passage.</p>
                  )}
                </>
              )}
            </div>
          </div>
          <aside className="research-side" aria-label="Start with what you have">
            <h2>Start with what you have</h2>
            {start.length ? (
              <ul className="research-list">
                {start.map((x) => (
                  <li key={x.id}>
                    <strong>{x.title}</strong>
                    <span className="muted">{x.note}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nothing of yours is tied to this passage yet.</p>
            )}
            <button type="button" className="research-group" onClick={() => setTab('Commentary')}>
              <BookOpen size={18} /> Commentaries & teaching (
              {material.commentaries.length + material.teaching.length})
            </button>
            <button
              type="button"
              className="research-group"
              onClick={() => setTab('Hymns & music')}
            >
              <Music size={18} /> Hymns & music ({material.hymns.length})
            </button>
            <a className="research-group" href={web} target="_blank" rel="noreferrer">
              <ExternalLink size={18} /> Find more outside my library
            </a>
          </aside>
        </div>
      )}
    </section>
  )
}
