import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Plus,
  Search,
  Upload,
  X,
} from 'lucide-react'
import type { Library } from '../lib/model'
import {
  blankSermon,
  deleteSermon,
  isWebLink,
  occasionKind,
  occasionKinds,
  parseSermonList,
  previewSermonImport,
  samePassage,
  saveSermon,
  searchSermons,
  sermonYear,
  type Sermon,
  type SermonImportPreview,
} from '../lib/sermons'
import {
  parseTextHistory,
  previewStructure,
  previewTextHistory,
  readStructureFile,
  type EnrichPreview,
} from '../lib/sermonImport'
import { searchSermonText } from '../lib/sermonText'
import { ManuscriptSection, SermonTextManager } from './SermonText'
import { SermonReview } from './SermonReview'
import { Modal } from './Modal'

const dateLabel = (date: string) =>
  date
    ? new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Date not recorded'
const meta = (s: Sermon) => [s.scripture, s.date ? dateLabel(s.date) : '', s.series].filter(Boolean)

// A location is a web link (opens) or a file path (shown and copyable). Nothing is opened for
// file paths because a web page cannot open files on a computer.
function Location({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  if (!value.trim()) return null
  return (
    <div className="sermon-location">
      <strong>{label}</strong>
      {isWebLink(value) ? (
        <a href={value.trim()} target="_blank" rel="noreferrer noopener">
          <ExternalLink size={14} /> Open
        </a>
      ) : (
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => setCopied(true))
          }}
        >
          {copied ? 'Copied' : 'Copy location'}
        </button>
      )}
      <span className="muted">{value}</span>
    </div>
  )
}

// A search excerpt with the matched words marked. [[word]] marks come from the search, and the
// text is shown as text, never as markup.
function Snippet({ text }: { text: string }) {
  return (
    <span className="sermon-snippet">
      {text.split('[[').flatMap((part, i) => {
        if (i === 0) return [part]
        const [word, ...rest] = part.split(']]')
        return [<mark key={i}>{word}</mark>, rest.join(']]')]
      })}
    </span>
  )
}
function SermonEditor({
  sermon,
  library,
  onSave,
  onClose,
}: {
  sermon: Sermon
  library: Library
  onSave: (library: Library) => boolean
  onClose: () => void
}) {
  const [draft, setDraft] = useState(sermon)
  const [themes, setThemes] = useState(sermon.themes.join('; '))
  const [error, setError] = useState('')
  const seriesNames = [...new Set(library.sermons.map((s) => s.series).filter(Boolean))].sort()
  const text = (key: 'title' | 'scripture' | 'occasion' | 'series', label: string, hint = '') => (
    <label>
      {label}
      {hint && <span className="muted">{hint}</span>}
      <input
        required={key === 'title'}
        list={key === 'series' ? 'sermon-series' : undefined}
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      />
    </label>
  )
  function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const themeList = themes.split(';')
      if (!onSave(saveSermon(library, { ...draft, themes: themeList })))
        setError('Could not save. Your changes are still in this form.')
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <Modal title={sermon.updatedAt ? 'Edit sermon' : 'Add sermon'} onClose={onClose} wide>
      <form onSubmit={submit} className="form-grid">
        {text('title', 'Title')}
        {text(
          'scripture',
          'Scripture',
          'For example Luke 15:11–32. Searches find overlapping passages.',
        )}
        <label>
          Date preached
          <span className="muted">Leave blank if you are not sure.</span>
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          />
        </label>
        {text('series', 'Series')}
        <datalist id="sermon-series">
          {seriesNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        {text('occasion', 'Occasion', 'For example Lent 3, funeral, wedding, ordination.')}
        <label>
          For (funeral, wedding, ordination)
          <span className="muted">Whom the service was for. Kept private; searchable.</span>
          <input
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
          />
        </label>
        <label>
          Church season
          <input
            value={draft.season}
            onChange={(e) => setDraft({ ...draft, season: e.target.value })}
          />
        </label>
        <label>
          Sermon structure
          <input
            list="sermon-structures"
            value={draft.structure}
            onChange={(e) => setDraft({ ...draft, structure: e.target.value })}
          />
        </label>
        <datalist id="sermon-structures">
          {[...new Set(library.sermons.map((s) => s.structure).filter(Boolean))].sort().map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <label>
          Themes (separate with semicolons)
          <input value={themes} onChange={(e) => setThemes(e.target.value)} />
        </label>
        <label className="wide-field">
          Summary
          <textarea
            rows={3}
            value={draft.summary}
            onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
          />
        </label>
        <label className="wide-field">
          Central image
          <textarea
            rows={2}
            value={draft.centralImage}
            onChange={(e) => setDraft({ ...draft, centralImage: e.target.value })}
          />
        </label>
        <label className="wide-field">
          Gospel statement
          <textarea
            rows={2}
            value={draft.gospelHandle}
            onChange={(e) => setDraft({ ...draft, gospelHandle: e.target.value })}
          />
        </label>
        <label className="wide-field">
          Manuscript location
          <span className="muted">
            A OneDrive or web link, or where the file lives, such as OneDrive / Sermons / 2025.
          </span>
          <input
            value={draft.manuscript}
            onChange={(e) => setDraft({ ...draft, manuscript: e.target.value })}
          />
        </label>
        <label className="wide-field">
          Recording location
          <input
            value={draft.recording}
            onChange={(e) => setDraft({ ...draft, recording: e.target.value })}
          />
        </label>
        <label className="wide-field">
          Personal notes
          <textarea
            rows={3}
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
            Save sermon
          </button>
        </div>
      </form>
    </Modal>
  )
}

type ImportMode = 'list' | 'history' | 'structure'
const MODES: [ImportMode, string][] = [
  ['list', 'Sermon list'],
  ['history', 'Text history'],
  ['structure', 'Structure review'],
]
const FIELD_LABELS: Record<string, string> = {
  opening: 'openings',
  closing: 'closings',
  centralImage: 'central images',
  gospelHandle: 'gospel statements',
  scripture: 'passages',
  series: 'series',
  date: 'dates',
  structure: 'structures',
}
function SermonImport({
  library,
  onSave,
  onClose,
}: {
  library: Library
  onSave: (library: Library) => boolean
  onClose: () => void
}) {
  const [mode, setMode] = useState<ImportMode>('list')
  const [text, setText] = useState('')
  const [folder, setFolder] = useState('')
  const [preview, setPreview] = useState<SermonImportPreview | null>(null)
  const [enrich, setEnrich] = useState<EnrichPreview | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const reset = () => {
    setPreview(null)
    setEnrich(null)
    setError('')
  }
  function choose(next: ImportMode) {
    setMode(next)
    setText('')
    setFileName('')
    reset()
  }
  async function readFile(file: File | undefined) {
    if (!file) return
    reset()
    setFileName(file.name)
    try {
      if (mode === 'structure') {
        setEnrich(previewStructure(await readStructureFile(file), library))
        return
      }
      if (file.size > 5_000_000) throw new Error('Please choose a file smaller than 5 MB.')
      const content = await file.text()
      if (mode === 'history') setEnrich(previewTextHistory(parseTextHistory(content), library))
      else setText(content)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this file.')
    }
  }
  const warnings = preview ? preview.entries.flatMap(({ row }) => row.warnings) : []
  return (
    <Modal title="Import sermon information" onClose={onClose} wide>
      <div className="tabs" aria-label="What to import">
        {MODES.map(([id, label]) => (
          <button key={id} className={mode === id ? 'selected' : ''} onClick={() => choose(id)}>
            {label}
          </button>
        ))}
      </div>
      {mode === 'list' && (
        <>
          <p>
            Choose your sermon index (CSV), or paste file names from a folder, one per line. Only
            what is written in the list is used: for file names, a date at the start and a Scripture
            reference such as “Luke 15”. Your files are not opened or moved.
          </p>
          <label>
            Sermon list
            <span className="muted">
              A CSV with a Title column (also Scripture, Date, Series, Occasion, Subject, Path,
              Liturgical Season, Lectionary Year), or file names such as 2025-03-16 Luke 15 The Lost
              Son.docx
            </span>
            <textarea
              rows={6}
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                reset()
              }}
            />
          </label>
          <label>
            Folder the files are in (optional)
            <span className="muted">
              Put in front of each file’s location, such as OneDrive/Sermons.
            </span>
            <input
              value={folder}
              onChange={(e) => {
                setFolder(e.target.value)
                reset()
              }}
            />
          </label>
        </>
      )}
      {mode === 'history' && (
        <p>
          Choose your sermon text history (a .md file). It fills in each sermon’s opening, closing,
          central image and gospel statement, and adds a passage where the index had none. It
          matches by the number at the start of each file name and never replaces anything already
          filled in. Sermons found only in the history are added.
        </p>
      )}
      {mode === 'structure' && (
        <p>
          Choose your sermon structure database (.xlsx, or a CSV saved from it). It adds each
          sermon’s structure, category and the reviewer’s reasoning, matched by file number. These
          were classified by an AI review; check any that matter to you.
        </p>
      )}
      <label className="file-label">
        <Upload size={16} />{' '}
        {mode === 'list'
          ? 'Choose a CSV or text file'
          : mode === 'history'
            ? 'Choose the text history file'
            : 'Choose the structure file'}
        <input
          aria-label={`Choose ${mode} file`}
          type="file"
          accept={
            mode === 'structure'
              ? '.xlsx,.csv,text/csv'
              : mode === 'history'
                ? '.md,.txt,text/markdown,text/plain'
                : '.csv,.txt,text/csv,text/plain'
          }
          onChange={(e) => {
            void readFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </label>
      {fileName && <p className="muted">{fileName}</p>}
      {mode === 'list' && (
        <button
          disabled={!text.trim()}
          onClick={() => {
            reset()
            try {
              setPreview(previewSermonImport(parseSermonList(text, folder), library))
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not read this list.')
            }
          }}
        >
          Preview import
        </button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <section className="import-review" aria-label="Sermon import preview">
          <h3>Review before saving</h3>
          <p>
            {preview.added} to add; {preview.entries.length - preview.added} already in your
            catalog. Passages and dates come only from the text you gave; correct any later.
          </p>
          {warnings.length > 0 && (
            <details>
              <summary>{warnings.length} things could not be read and were left blank</summary>
              <ul>
                {warnings.slice(0, 50).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
          <ul className="sermon-preview">
            {preview.entries.slice(0, 200).map(({ row, action }, i) => (
              <li key={i}>
                <strong>{row.title}</strong> — {action}
                <div className="muted">
                  {[row.scripture && `Passage: ${row.scripture}`, row.date && `Date: ${row.date}`]
                    .filter(Boolean)
                    .join(' · ') || 'No date or passage found'}
                </div>
              </li>
            ))}
          </ul>
          {preview.entries.length > 200 && (
            <p className="muted">Showing the first 200 of {preview.entries.length}.</p>
          )}
          <button
            className="primary"
            disabled={!preview.added}
            onClick={() => {
              if (!onSave(preview.library))
                setError('Could not save the import. Your list is still here.')
            }}
          >
            Import {preview.added} sermons
          </button>
        </section>
      )}
      {enrich && (
        <section className="import-review" aria-label="Sermon update preview">
          <h3>Review before saving</h3>
          <p>
            {enrich.updated} sermons will be updated
            {enrich.added ? ` and ${enrich.added} added` : ''}.
            {enrich.unmatched
              ? ` ${enrich.unmatched} entries matched no sermon in your catalog.`
              : ''}
          </p>
          <ul>
            {Object.entries(enrich.filled).map(([field, count]) => (
              <li key={field}>
                {count} {FIELD_LABELS[field] || field} filled in
              </li>
            ))}
          </ul>
          <p className="muted">Anything already filled in is left exactly as it is.</p>
          <button
            className="primary"
            disabled={!enrich.updated && !enrich.added}
            onClick={() => {
              if (!onSave(enrich.library)) setError('Could not save. Your file is still loaded.')
            }}
          >
            Save these changes
          </button>
        </section>
      )}
    </Modal>
  )
}

function SermonDetail({
  sermon,
  library,
  onBack,
  onEdit,
  onOpen,
  onDelete,
}: {
  sermon: Sermon
  library: Library
  onBack: () => void
  onEdit: () => void
  onOpen: (id: string) => void
  onDelete: () => void
}) {
  const related = samePassage(library, sermon)
  const [confirming, setConfirming] = useState(false)
  return (
    <article className="sermon-detail">
      <button onClick={onBack}>
        <ArrowLeft size={16} /> All sermons
      </button>
      <h1>{sermon.title}</h1>
      <p className="muted">{meta(sermon).join(' · ') || dateLabel('')}</p>
      <div className="sermon-actions">
        <button onClick={onEdit}>Edit</button>
        {confirming ? (
          <>
            <span>Remove this record? Your files are not touched.</span>
            <button onClick={onDelete}>Yes, remove</button>
            <button onClick={() => setConfirming(false)}>Keep</button>
          </>
        ) : (
          <button onClick={() => setConfirming(true)}>Remove</button>
        )}
      </div>
      <dl className="sermon-facts">
        {sermon.occasion && (
          <>
            <dt>Occasion</dt>
            <dd>{sermon.occasion}</dd>
          </>
        )}
        {occasionKind(sermon) && (
          <>
            <dt>Kind of service</dt>
            <dd>{occasionKind(sermon)}</dd>
          </>
        )}
        {sermon.subject && (
          <>
            <dt>For</dt>
            <dd>{sermon.subject}</dd>
          </>
        )}
        {(sermon.season || sermon.liturgicalDay || sermon.lectionaryYear) && (
          <>
            <dt>Church year</dt>
            <dd>
              {[
                sermon.liturgicalDay,
                sermon.season,
                sermon.lectionaryYear && `Year ${sermon.lectionaryYear}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </dd>
          </>
        )}
        {sermon.scriptureSource && sermon.scriptureSource !== 'Sermon list' && (
          <>
            <dt>Passage source</dt>
            <dd>{sermon.scriptureSource}</dd>
          </>
        )}
        {sermon.themes.length > 0 && (
          <>
            <dt>Themes</dt>
            <dd>{sermon.themes.join(', ')}</dd>
          </>
        )}
      </dl>
      {(sermon.formerTitles.length > 0 || sermon.reviewNote) && (
        <section className="detail-section">
          <h3>From a review</h3>
          {sermon.formerTitles.length > 0 && (
            <p>
              Former {sermon.formerTitles.length === 1 ? 'title' : 'titles'}:{' '}
              {sermon.formerTitles.join('; ')}
            </p>
          )}
          {sermon.reviewNote && <p className="muted">{sermon.reviewNote}</p>}
        </section>
      )}
      {sermon.summary && (
        <section className="detail-section">
          <h3>Summary</h3>
          <p>{sermon.summary}</p>
        </section>
      )}
      {sermon.centralImage && (
        <section className="detail-section">
          <h3>Central image</h3>
          <p>{sermon.centralImage}</p>
        </section>
      )}
      {sermon.gospelHandle && (
        <section className="detail-section">
          <h3>Gospel statement</h3>
          <p>{sermon.gospelHandle}</p>
        </section>
      )}
      {sermon.structure && (
        <section className="detail-section">
          <h3>Structure</h3>
          <p>
            <strong>{sermon.structure}</strong>
            {sermon.structureCategory && ` (${sermon.structureCategory})`}
          </p>
          {sermon.structureNote && <p>{sermon.structureNote}</p>}
          {sermon.structureSource && (
            <p className="muted">
              {sermon.structureSource}
              {sermon.structureConfidence && `, ${sermon.structureConfidence} confidence`}. Check it
              against the sermon.
            </p>
          )}
        </section>
      )}
      {(sermon.opening || sermon.closing) && (
        <section className="detail-section">
          <h3>Opening and closing</h3>
          {sermon.opening && (
            <p>
              <strong>Opens:</strong> {sermon.opening}
            </p>
          )}
          {sermon.closing && (
            <p>
              <strong>Closes:</strong> {sermon.closing}
            </p>
          )}
        </section>
      )}
      <section className="detail-section">
        <h3>Where to find it</h3>
        {sermon.manuscript || sermon.recording ? (
          <>
            <Location label="Manuscript" value={sermon.manuscript} />
            <Location label="Recording" value={sermon.recording} />
          </>
        ) : (
          <p className="muted">No location recorded yet. Edit this sermon to add one.</p>
        )}
      </section>
      <ManuscriptSection sermon={sermon} />
      {sermon.notes && (
        <section className="detail-section">
          <h3>Personal notes</h3>
          <p>{sermon.notes}</p>
        </section>
      )}
      {related.length > 0 && (
        <section className="detail-section">
          <h3>Other sermons on this passage</h3>
          <ul className="sermon-related">
            {related.map((s) => (
              <li key={s.id}>
                <button onClick={() => onOpen(s.id)}>{s.title}</button>
                <span className="muted">
                  {[s.scripture, s.date && dateLabel(s.date)].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}

export function SermonCatalog({
  library,
  onSave,
}: {
  library: Library
  onSave: (library: Library) => boolean
}) {
  const [query, setQuery] = useState('')
  const [series, setSeries] = useState('')
  const [year, setYear] = useState('')
  const [season, setSeason] = useState('')
  const [structure, setStructure] = useState('')
  const [kind, setKind] = useState('')
  const [openId, setOpenId] = useState('')
  const [editing, setEditing] = useState<Sermon | null>(null)
  const [importing, setImporting] = useState(false)
  const [manuscripts, setManuscripts] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  // Bumped when manuscripts may have changed, so the manuscript search is run again.
  const [epoch, setEpoch] = useState(0)
  const [textResult, setTextResult] = useState<{
    query: string
    epoch: number
    hits: Map<string, string>
    failed: boolean
  }>({ query: '', epoch: 0, hits: new Map(), failed: false })
  const [limit, setLimit] = useState(50)
  const sermons = library.sermons
  const seriesNames = useMemo(
    () => [...new Set(sermons.map((s) => s.series).filter(Boolean))].sort(),
    [sermons],
  )
  const years = useMemo(
    () => [...new Set(sermons.map(sermonYear).filter(Boolean))].sort().reverse(),
    [sermons],
  )
  const seasons = useMemo(
    () => [...new Set(sermons.map((s) => s.season).filter(Boolean))].sort(),
    [sermons],
  )
  const structures = useMemo(
    () => [...new Set(sermons.map((s) => s.structure).filter(Boolean))].sort(),
    [sermons],
  )
  const metadataHits = useMemo(
    () => searchSermons(sermons, query, { series, year, season, structure, kind }),
    [sermons, query, series, year, season, structure, kind],
  )
  // Words in the saved manuscripts are searched on the shared library, shortly after typing.
  const q = query.trim()
  useEffect(() => {
    if (q.length < 3) return
    let live = true
    const timer = setTimeout(() => {
      searchSermonText(q)
        .then((found) => {
          if (live)
            setTextResult({
              query: q,
              epoch,
              hits: new Map((found || []).map((h) => [h.id, h.snippet])),
              failed: false,
            })
        })
        .catch(() => live && setTextResult({ query: q, epoch, hits: new Map(), failed: true }))
    }, 350)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [q, epoch])
  const current = q.length >= 3 && textResult.query === q && textResult.epoch === epoch
  const textHits = useMemo(
    () => (current ? textResult.hits : new Map<string, string>()),
    [current, textResult],
  )
  const textSearch =
    q.length < 3 ? 'idle' : !current ? 'searching' : textResult.failed ? 'unavailable' : 'done'
  const hits = useMemo(() => {
    if (!textHits.size) return metadataHits
    const known = new Set(metadataHits.map((h) => h.sermon.id))
    const merged = metadataHits.map((h) =>
      textHits.has(h.sermon.id)
        ? { ...h, reasons: [...h.reasons, 'In the manuscript'], snippet: textHits.get(h.sermon.id) }
        : h,
    )
    const allowed = new Map(
      searchSermons(sermons, '', { series, year, season, structure, kind }).map((h) => [
        h.sermon.id,
        h.sermon,
      ]),
    )
    for (const [id, snippet] of textHits) {
      const sermon = allowed.get(id)
      if (sermon && !known.has(id)) merged.push({ sermon, reasons: ['In the manuscript'], snippet })
    }
    return merged
  }, [metadataHits, textHits, sermons, series, year, season, structure, kind])
  const open = sermons.find((s) => s.id === openId)
  return (
    <section className="sermons" aria-label="Sermons">
      {open ? (
        <SermonDetail
          key={open.id}
          sermon={open}
          library={library}
          onBack={() => {
            setOpenId('')
            setEpoch((n) => n + 1)
          }}
          onEdit={() => setEditing(open)}
          onOpen={setOpenId}
          onDelete={() => {
            if (onSave(deleteSermon(library, open.id))) setOpenId('')
          }}
        />
      ) : (
        <>
          <header className="sermons-head">
            <div>
              <h1>Sermons</h1>
              <p className="muted">
                {sermons.length
                  ? `${sermons.length.toLocaleString()} sermons in your catalog`
                  : 'A catalog of what you have preached, and where each manuscript lives.'}
              </p>
            </div>
            <div className="sermon-actions">
              <button className="primary" onClick={() => setEditing(blankSermon())}>
                <Plus size={16} /> Add sermon
              </button>
              <button onClick={() => setImporting(true)}>
                <Upload size={16} /> Import list
              </button>
              <button onClick={() => setManuscripts(true)}>
                <FileText size={16} /> Manuscripts
              </button>
              <button onClick={() => setReviewing(true)}>
                <ClipboardCheck size={16} /> Review
              </button>
            </div>
          </header>
          <div className="search-bar">
            <Search size={20} />
            <input
              aria-label="Search sermons"
              placeholder="Search by passage (Luke 15), title, theme, image, series, or notes..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setLimit(50)
              }}
            />
            {query && (
              <button
                className="icon-button"
                aria-label="Clear sermon search"
                onClick={() => setQuery('')}
              >
                <X size={16} />
              </button>
            )}
          </div>
          {sermons.length > 0 && (
            <div className="sermon-filters">
              <label>
                Series
                <select value={series} onChange={(e) => setSeries(e.target.value)}>
                  <option value="">All series</option>
                  {seriesNames.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label>
                Year
                <select value={year} onChange={(e) => setYear(e.target.value)}>
                  <option value="">All years</option>
                  {years.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </label>
              <label>
                Kind of service
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="">All sermons</option>
                  {occasionKinds.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              {seasons.length > 0 && (
                <label>
                  Church season
                  <select value={season} onChange={(e) => setSeason(e.target.value)}>
                    <option value="">All seasons</option>
                    {seasons.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
              )}
              {structures.length > 0 && (
                <label>
                  Structure
                  <select value={structure} onChange={(e) => setStructure(e.target.value)}>
                    <option value="">All structures</option>
                    {structures.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          {query.trim() && (
            <p className="muted" role="status">
              {hits.length} {hits.length === 1 ? 'match' : 'matches'}.{' '}
              {textSearch === 'unavailable'
                ? 'Search covers the details recorded here; manuscript text could not be searched right now.'
                : textSearch === 'searching'
                  ? 'Searching manuscripts too…'
                  : 'Search covers the details recorded here and your saved manuscripts.'}
            </p>
          )}
          {sermons.length === 0 ? (
            <div className="empty-state">
              <p>
                No sermons yet. Add one, or import a list of file names from your OneDrive or
                computer folder. Each record holds the passage, date, and where the manuscript
                lives; your files stay where they are.
              </p>
            </div>
          ) : hits.length === 0 ? (
            <p className="muted">
              Nothing matches. For a passage, try a form like “John 3” or “Ps 23”.
            </p>
          ) : (
            <ul className="sermon-list">
              {hits.slice(0, limit).map(({ sermon, reasons, snippet }) => (
                <li key={sermon.id}>
                  <button className="sermon-row" onClick={() => setOpenId(sermon.id)}>
                    <strong>{sermon.title}</strong>
                    <span className="muted">{meta(sermon).join(' · ') || 'Date not recorded'}</span>
                    {reasons.length > 0 && (
                      <span className="sermon-reason">{reasons.join(' · ')}</span>
                    )}
                    {snippet && <Snippet text={snippet} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {hits.length > limit && (
            <button onClick={() => setLimit(limit + 50)}>
              Show more ({hits.length - limit} remaining)
            </button>
          )}
        </>
      )}
      {editing && (
        <SermonEditor
          sermon={editing}
          library={library}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            if (onSave(next)) {
              setOpenId(editing.id)
              setEditing(null)
              return true
            }
            return false
          }}
        />
      )}
      {reviewing && (
        <SermonReview library={library} onSave={onSave} onClose={() => setReviewing(false)} />
      )}
      {manuscripts && (
        <SermonTextManager
          library={library}
          onSave={onSave}
          onClose={() => {
            setManuscripts(false)
            setEpoch((n) => n + 1)
          }}
        />
      )}
      {importing && (
        <SermonImport
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
    </section>
  )
}
