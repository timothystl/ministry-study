import { useMemo, useState, type FormEvent } from 'react'
import { Download, ExternalLink, Mail, Plus, Printer, Search, Upload } from 'lucide-react'
import type { Library } from '../lib/model'
import {
  blankPrayer,
  blankSet,
  buildPrayers,
  categories,
  defaultSelections,
  deletePrayer,
  lcmsLinks,
  loadStarterBiddings,
  parsePrayerFile,
  prayerMailto,
  prayerTypes,
  previewPrayerImport,
  printableHtml,
  savePrayer,
  searchPrayers,
  stripResponse,
  type Prayer,
  type PrayerSet,
} from '../lib/prayers'
import { downloadBlob } from '../lib/sermonText'
import { Modal } from './Modal'

const keyOf = (p: Prayer) => p.categoryKey || p.category || 'other'

function PrayerEditor({
  prayer,
  library,
  onSave,
  onClose,
}: {
  prayer: Prayer
  library: Library
  onSave: (library: Library) => boolean
  onClose: () => void
}) {
  const [draft, setDraft] = useState(prayer)
  const [tags, setTags] = useState(prayer.tags.join('; '))
  const [error, setError] = useState('')
  const names = [...new Set(library.prayers.map((p) => p.category).filter(Boolean))].sort()
  function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const category = draft.category.trim()
      const known = library.prayers.find((p) => p.category === category)
      const next = {
        ...draft,
        category,
        categoryKey: known?.categoryKey || draft.categoryKey,
        categoryNote: known?.categoryNote || draft.categoryNote,
        tags: tags.split(';'),
      }
      if (!onSave(savePrayer(library, next)))
        setError('Could not save. Your changes are still in this form.')
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <Modal title={prayer.updatedAt ? 'Edit prayer' : 'Add prayer'} onClose={onClose} wide>
      <form onSubmit={submit} className="form-grid">
        <label>
          Title
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
        <label>
          Type
          <select
            value={draft.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value as Prayer['type'] })}
          >
            {prayerTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Category
          <span className="muted">Biddings are grouped by category when building.</span>
          <input
            list="prayer-categories"
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          />
        </label>
        <datalist id="prayer-categories">
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <label>
          Tags (separate with semicolons)
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <label className="wide-field">
          Text
          <span className="muted">
            Write [names] where names should go. A biddings closing “Lord, in your mercy,” is added
            once when building.
          </span>
          <textarea
            rows={7}
            required
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          />
        </label>
        <label className="wide-field">
          Notes
          <textarea
            rows={2}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </label>
        {error && (
          <p className="error wide-field" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions wide-field">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            Save prayer
          </button>
        </div>
      </form>
    </Modal>
  )
}

function PrayerImport({
  library,
  onSave,
  onClose,
}: {
  library: Library
  onSave: (library: Library) => boolean
  onClose: () => void
}) {
  const [state, setState] = useState<{
    added: number
    skipped: number
    library: Library
    categories: number
    starters: number
  } | null>(null)
  const [error, setError] = useState('')
  async function read(file: File | undefined) {
    if (!file) return
    setError('')
    setState(null)
    try {
      if (file.size > 5_000_000) throw new Error('Please choose a file smaller than 5 MB.')
      const found = parsePrayerFile(await file.text())
      setState({
        ...previewPrayerImport(found, library),
        categories: found.categories,
        starters: found.starters,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this file.')
    }
  }
  return (
    <Modal title="Import prayers" onClose={onClose} wide>
      <p>
        Choose your Prayers of the Church builder file (the .tsx you worked on), or the same prayers
        as JSON. Categories, biddings and sermon-theme starters come in as prayers you can edit.
        Nothing is saved until you confirm, and prayers already in your library are skipped.
      </p>
      <label className="file-label">
        <Upload size={16} /> Choose prayer file
        <input
          aria-label="Choose prayer file"
          type="file"
          accept=".tsx,.ts,.js,.jsx,.json,text/plain,application/json"
          onChange={(e) => {
            void read(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {state && (
        <section className="import-review" aria-label="Prayer import preview">
          <p>
            {state.categories} categories and {state.starters} sermon starters found: {state.added}{' '}
            prayers to add, {state.skipped} already in your library.
          </p>
          <button
            className="primary"
            disabled={!state.added}
            onClick={() => {
              if (!onSave(state.library)) setError('Could not save the prayers.')
            }}
          >
            Import {state.added} prayers
          </button>
        </section>
      )}
    </Modal>
  )
}

function LibraryTab({ library, onSave }: { library: Library; onSave: (l: Library) => boolean }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [type, setType] = useState('')
  const [editing, setEditing] = useState<Prayer | null>(null)
  const [importing, setImporting] = useState(false)
  const [copied, setCopied] = useState('')
  const [confirm, setConfirm] = useState('')
  const cats = useMemo(() => categories(library.prayers), [library.prayers])
  const shown = searchPrayers(library.prayers, query, category, type)
  return (
    <>
      <div className="sermon-actions">
        <button className="primary" onClick={() => setEditing(blankPrayer())}>
          <Plus size={16} /> Add prayer
        </button>
        <button onClick={() => setImporting(true)}>
          <Upload size={16} /> Import prayers
        </button>
      </div>
      <div className="search-bar">
        <Search size={20} />
        <input
          aria-label="Search prayers"
          placeholder="Search prayers by words, title, or category..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="sermon-filters">
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {[
              ...cats.map((c) => c.name),
              ...(library.prayers.some((p) => p.type !== 'Bidding' && !p.category) ? [] : []),
            ].map((n) => (
              <option key={n}>{n}</option>
            ))}
            {library.prayers.some((p) => p.category === 'Sermon starters') && (
              <option>Sermon starters</option>
            )}
          </select>
        </label>
        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {prayerTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      {library.prayers.length === 0 ? (
        <div className="empty-state">
          <p>
            No prayers yet. Start with the built-in biddings, import your Prayers of the Church
            builder file, or add a prayer.
          </p>
          <button className="primary" onClick={() => onSave(loadStarterBiddings(library).library)}>
            Load starter biddings
          </button>
        </div>
      ) : shown.length === 0 ? (
        <p className="muted">Nothing matches.</p>
      ) : (
        <ul className="sermon-list">
          {shown.map((p) => (
            <li key={p.id} className="prayer-card">
              <strong>{p.title || '(untitled)'}</strong>
              <span className="muted">
                {[p.type, p.category, p.tags.join(', ')].filter(Boolean).join(' · ')}
              </span>
              <p className="prayer-text">{p.text}</p>
              <div className="sermon-actions">
                <button
                  onClick={() =>
                    void navigator.clipboard?.writeText(p.text).then(() => setCopied(p.id))
                  }
                >
                  {copied === p.id ? 'Copied' : 'Copy'}
                </button>
                <button onClick={() => setEditing(p)}>Edit</button>
                {confirm === p.id ? (
                  <>
                    <span>Remove this prayer?</span>
                    <button
                      onClick={() => {
                        onSave(deletePrayer(library, p.id))
                        setConfirm('')
                      }}
                    >
                      Yes, remove
                    </button>
                    <button onClick={() => setConfirm('')}>Keep</button>
                  </>
                ) : (
                  <button onClick={() => setConfirm(p.id)}>Remove</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <PrayerEditor
          prayer={editing}
          library={library}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            if (onSave(next)) {
              setEditing(null)
              return true
            }
            return false
          }}
        />
      )}
      {importing && (
        <PrayerImport
          library={library}
          onClose={() => setImporting(false)}
          onSave={(next) => {
            if (onSave(next)) {
              setImporting(false)
              return true
            }
            return false
          }}
        />
      )}
    </>
  )
}

function BuildTab({
  library,
  onSave,
  draft,
  setDraft,
}: {
  library: Library
  onSave: (l: Library) => boolean
  draft: PrayerSet
  setDraft: (s: PrayerSet) => void
}) {
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState('')
  const [emailNote, setEmailNote] = useState('')
  const [emailTo, setEmailTo] = useState(() => {
    try {
      return localStorage.getItem('prayerEmailTo') || ''
    } catch {
      return ''
    }
  })
  const cats = useMemo(() => categories(library.prayers), [library.prayers])
  const starters = library.prayers.filter((p) => p.type === 'Sermon starter')
  const biddings = (name: string) =>
    library.prayers.filter((p) => p.type === 'Bidding' && (p.category || 'Other') === name)
  const chosen = (key: string) => draft.selections.find((s) => s.categoryKey === key)?.prayerId
  const text = buildPrayers(draft, library.prayers)
  const choose = (key: string, id: string) =>
    setDraft({
      ...draft,
      selections:
        chosen(key) === id
          ? draft.selections.filter((s) => s.categoryKey !== key)
          : [
              ...draft.selections.filter((s) => s.categoryKey !== key),
              { categoryKey: key, prayerId: id },
            ],
    })
  // Selections stay in the order of the library's categories.
  const ordered = {
    ...draft,
    selections: cats.flatMap((c) =>
      draft.selections.filter((s) => s.categoryKey === (c.key || c.name)),
    ),
  }
  const finalText = buildPrayers(ordered, library.prayers)
  const sermon = library.sermons.find((s) => s.id === draft.sermonId)
  function save() {
    const keep = draft.namesKept
    const record: PrayerSet = {
      ...ordered,
      names: keep ? draft.names : { sick: '', grieving: '', birthdays: '' },
      text: keep
        ? finalText
        : buildPrayers(
            { ...ordered, names: { sick: '', grieving: '', birthdays: '' } },
            library.prayers,
          ),
      lcms: draft.lcms,
      updatedAt: new Date().toISOString(),
    }
    const exists = library.prayerSets.some((s) => s.id === record.id)
    const next = {
      ...library,
      prayerSets: exists
        ? library.prayerSets.map((s) => (s.id === record.id ? record : s))
        : [...library.prayerSets, record],
    }
    setSaved(onSave(next) ? 'Saved.' : 'Could not save.')
  }
  void text
  function email() {
    const sub = `Prayers of the Church${draft.sunday ? ` — ${draft.sunday}` : ''}${draft.date ? ` (${draft.date})` : ''}`
    const { href, complete } = prayerMailto(emailTo, sub, finalText)
    try {
      localStorage.setItem('prayerEmailTo', emailTo)
    } catch {
      // Remembering the address is a convenience only.
    }
    if (!complete) {
      void navigator.clipboard?.writeText(finalText)
      setEmailNote(
        'These prayers are long for a link, so they were copied. Paste them into the email.',
      )
    } else setEmailNote('')
    window.location.href = href
  }
  function print() {
    const w = window.open('', '_blank')
    if (!w) {
      setEmailNote('Your browser blocked the print window. Allow pop-ups, or use Download.')
      return
    }
    w.document.write(printableHtml(finalText))
    w.document.close()
    w.focus()
    w.print()
  }
  return (
    <div className="prayer-build">
      <section>
        <div className="form-grid">
          <label>
            Sunday or occasion
            <input
              value={draft.sunday}
              onChange={(e) => setDraft({ ...draft, sunday: e.target.value })}
              placeholder="Proper 21"
            />
          </label>
          <label>
            Date
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </label>
          <label className="wide-field">
            Sermon (optional)
            <select
              value={draft.sermonId}
              onChange={(e) => {
                const s = library.sermons.find((x) => x.id === e.target.value)
                setDraft({
                  ...draft,
                  sermonId: e.target.value,
                  scripture: s?.scripture || draft.scripture,
                })
              }}
            >
              <option value="">None</option>
              {[...library.sermons]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 300)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {[s.date, s.title].filter(Boolean).join(' · ')}
                  </option>
                ))}
            </select>
          </label>
          <label className="wide-field">
            Text
            <input
              value={draft.scripture}
              onChange={(e) => setDraft({ ...draft, scripture: e.target.value })}
              placeholder="Luke 16:19–31"
            />
          </label>
          {(['sick', 'grieving', 'birthdays'] as const).map((k) => (
            <label key={k} className="wide-field">
              {k === 'sick'
                ? 'Names of the sick'
                : k === 'grieving'
                  ? 'Names of the grieving'
                  : 'Birthdays and anniversaries'}
              <input
                value={draft.names[k]}
                onChange={(e) =>
                  setDraft({ ...draft, names: { ...draft.names, [k]: e.target.value } })
                }
              />
            </label>
          ))}
        </div>
        <h3>Choose one bidding for each category</h3>
        {cats.length === 0 ? (
          <div className="empty-state">
            <p>There are no biddings to choose from yet.</p>
            <button
              className="primary"
              onClick={() => onSave(loadStarterBiddings(library).library)}
            >
              Load starter biddings
            </button>
            <p className="muted">
              You can also import your own builder file from the Library tab; nothing is replaced.
            </p>
          </div>
        ) : (
          <button
            onClick={() => setDraft({ ...draft, selections: defaultSelections(library.prayers) })}
          >
            Choose the first bidding in every category
          </button>
        )}
        {cats.map((c) => {
          const key = c.key || c.name
          const current = chosen(key)
          return (
            <details key={c.name}>
              <summary>
                {c.name} <span className="muted">{current ? '· chosen' : `· ${c.count}`}</span>
              </summary>
              {c.note && <p className="muted">{c.note}</p>}
              {biddings(c.name).map((p) => (
                <label key={p.id} className="review-change">
                  <input
                    type="checkbox"
                    checked={current === p.id}
                    onChange={() => choose(keyOf(p), p.id)}
                  />
                  <span>
                    <strong>{p.title}</strong>
                    <span
                      className="review-from"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      {p.text}
                    </span>
                  </span>
                </label>
              ))}
            </details>
          )
        })}
        <h3>This week’s LCMS prayer</h3>
        <p className="muted">
          The LCMS posts its Prayers of the Church each week as a PDF. Open the page, copy the
          prayer for {draft.sunday || 'this Sunday'}, and paste it below to pray with the wider
          church. Each opens in a new tab.
        </p>
        <p className="lcms-links">
          {lcmsLinks.map(([label, href]) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} /> {label}
            </a>
          ))}
        </p>
        <label className="wide-field">
          LCMS weekly prayer (pasted)
          <textarea
            rows={5}
            value={draft.lcms}
            onChange={(e) => setDraft({ ...draft, lcms: e.target.value })}
            placeholder="Paste the LCMS prayer here. © The Lutheran Church—Missouri Synod."
          />
        </label>
        <h3>Other concerns and the sermon</h3>
        <label className="wide-field">
          Other concerns
          <textarea
            rows={3}
            value={draft.other}
            onChange={(e) => setDraft({ ...draft, other: e.target.value })}
          />
        </label>
        <label className="wide-field">
          Sermon-tied petition
          {starters.length > 0 && (
            <select
              aria-label="Start from a sermon theme"
              value=""
              onChange={(e) => {
                const s = starters.find((x) => x.id === e.target.value)
                if (s) setDraft({ ...draft, petition: stripResponse(s.text) })
              }}
            >
              <option value="">Start from a sermon theme…</option>
              {starters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          )}
          <textarea
            rows={4}
            value={draft.petition}
            onChange={(e) => setDraft({ ...draft, petition: e.target.value })}
          />
        </label>
      </section>
      <section aria-label="Prayers of the Church preview">
        <h3>Preview</h3>
        <pre className="manuscript prayer-preview">{finalText}</pre>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.namesKept}
            onChange={(e) => setDraft({ ...draft, namesKept: e.target.checked })}
          />
          Keep the names in the saved copy (they stay in your private library)
        </label>
        {sermon && <p className="muted">Linked to “{sermon.title}”.</p>}
        <div className="sermon-actions">
          <button
            className="primary"
            onClick={() =>
              void navigator.clipboard?.writeText(finalText).then(() => setCopied(true))
            }
          >
            {copied ? 'Copied' : 'Copy all'}
          </button>
          <button
            onClick={() =>
              downloadBlob(
                new TextEncoder().encode(finalText),
                `prayers-${draft.date || 'draft'}.txt`,
                'text/plain',
              )
            }
          >
            <Download size={16} /> Download
          </button>
          <button onClick={print}>
            <Printer size={16} /> Print or save as PDF
          </button>
          <button
            onClick={save}
            disabled={!ordered.selections.length && !draft.other.trim() && !draft.petition.trim()}
          >
            Save this service
          </button>
        </div>
        <div className="form-grid">
          <label className="wide-field">
            Email to
            <input
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="worship team, or leave blank"
            />
          </label>
        </div>
        <div className="sermon-actions">
          <button onClick={email}>
            <Mail size={16} /> Email these prayers
          </button>
        </div>
        {emailNote && <p role="status">{emailNote}</p>}
        {saved && <p role="status">{saved}</p>}
      </section>
    </div>
  )
}

function SavedTab({
  library,
  onSave,
  onOpen,
}: {
  library: Library
  onSave: (l: Library) => boolean
  onOpen: (s: PrayerSet) => void
}) {
  const sets = [...library.prayerSets].sort((a, b) => b.date.localeCompare(a.date))
  if (!sets.length)
    return <p className="muted">No saved services yet. Build one and choose Save this service.</p>
  return (
    <ul className="sermon-list">
      {sets.map((s) => (
        <li key={s.id} className="prayer-card">
          <strong>{[s.sunday, s.date].filter(Boolean).join(' · ') || 'Saved service'}</strong>
          <span className="muted">
            {[s.scripture, `${s.selections.length} biddings`].filter(Boolean).join(' · ')}
          </span>
          <div className="sermon-actions">
            <button onClick={() => onOpen(s)}>Open to reuse</button>
            <button onClick={() => void navigator.clipboard?.writeText(s.text)}>Copy text</button>
            <button
              onClick={() =>
                onSave({ ...library, prayerSets: library.prayerSets.filter((x) => x.id !== s.id) })
              }
            >
              Remove
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function Prayers({
  library,
  onSave,
}: {
  library: Library
  onSave: (library: Library) => boolean
}) {
  const [tab, setTab] = useState<'library' | 'build' | 'saved'>('library')
  const [draft, setDraft] = useState<PrayerSet>(blankSet)
  return (
    <section className="sermons" aria-label="Prayers">
      <header className="sermons-head">
        <div>
          <h1>Prayers</h1>
          <p className="muted">
            {library.prayers.length
              ? `${library.prayers.length} prayers · ${library.prayerSets.length} saved services`
              : 'Biddings, prayers and devotions, and a builder for the Prayers of the Church.'}
          </p>
        </div>
      </header>
      <div className="tabs" aria-label="Prayers sections">
        {(
          [
            ['library', 'Library'],
            ['build', 'Build the Prayers of the Church'],
            ['saved', `Saved services`],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'library' && <LibraryTab library={library} onSave={onSave} />}
      {tab === 'build' && (
        <BuildTab library={library} onSave={onSave} draft={draft} setDraft={setDraft} />
      )}
      {tab === 'saved' && (
        <SavedTab
          library={library}
          onSave={onSave}
          onOpen={(s) => {
            setDraft({ ...s })
            setTab('build')
          }}
        />
      )}
    </section>
  )
}
