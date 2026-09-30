import { useMemo, useState, type FormEvent } from 'react'
import { Copy, Plus, Search, Upload } from 'lucide-react'
import {
  allUsage,
  applyFilePlan,
  blankHymn,
  deleteHymn,
  fileKinds,
  hymnarySearchUrl,
  isWebLocation,
  liturgiesForHymn,
  mergeHymns,
  parseHymnList,
  planFiles,
  saveHymn,
  searchHymns,
  HYMN_CSV_HEADERS,
  MAX_HYMN_TEXT,
  type FilePlan,
  type Hymn,
} from '../lib/hymns'
import type { Library } from '../lib/model'
import { attachmentRefs, removeUnused } from '../lib/attachments'
import { Attachments } from './Attachments'
import { Modal } from './Modal'

const facts = (h: Hymn): [string, string][] => [
  ['Tune', h.tune],
  ['Composer', h.composer],
  ['Lyricist', h.lyricist],
  ['Arranged by', h.arranger],
  ['Meter', h.meter],
  ['Passage', h.scripture],
  ['Year', h.year],
  ['Key', h.key],
  ['Hymnal', h.hymnal],
  ['Used for', h.usage.join(', ')],
  ['Themes', h.themes.join(', ')],
  ['Copyright', h.copyright],
]
const credit = (h: Hymn) =>
  [h.lyricist && `Words: ${h.lyricist}`, h.composer && `Music: ${h.composer}`, h.tune]
    .filter(Boolean)
    .join(' · ')

export function Location({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return isWebLocation(value) ? (
    <a href={value} target="_blank" rel="noreferrer">
      {value.length > 60 ? `${value.slice(0, 57)}…` : value}
    </a>
  ) : (
    <span>
      <code>{value}</code>{' '}
      <button
        type="button"
        aria-label={`Copy ${value}`}
        onClick={() => void navigator.clipboard?.writeText(value).then(() => setCopied(true))}
      >
        <Copy size={13} /> {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  )
}

export function HymnEditor({
  hymn,
  library,
  onSave,
  onClose,
}: {
  hymn: Hymn
  library: Library
  onSave: (library: Library) => boolean
  onClose: () => void
}) {
  const [draft, setDraft] = useState(hymn)
  const [usage, setUsage] = useState(hymn.usage.join('; '))
  const [themes, setThemes] = useState(hymn.themes.join('; '))
  const [error, setError] = useState('')
  const set = (patch: Partial<Hymn>) => setDraft({ ...draft, ...patch })
  function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const next = saveHymn(library, {
        ...draft,
        usage: usage.split(';'),
        themes: themes.split(';'),
      })
      if (!onSave(next)) setError('Could not save. Your changes are still in this form.')
    } catch (err) {
      setError((err as Error).message)
    }
  }
  const text = (key: keyof Hymn & string, label: string, hint = '') => (
    <label>
      {label}
      {hint && <span className="muted">{hint}</span>}
      <input value={draft[key] as string} onChange={(e) => set({ [key]: e.target.value })} />
    </label>
  )
  return (
    <Modal title={hymn.updatedAt ? 'Edit hymn' : 'Add a hymn'} onClose={onClose} wide>
      <form onSubmit={submit} className="form-grid">
        {error && (
          <p role="alert" className="error wide-field">
            {error}
          </p>
        )}
        {text('title', 'Title')}
        {text('firstLine', 'First line')}
        {text('tune', 'Tune name')}
        {text('meter', 'Meter', 'For example 87 87 D')}
        {text('composer', 'Composer')}
        {text('lyricist', 'Lyricist')}
        {text('arranger', 'Arranger')}
        {text('year', 'Year')}
        {text('key', 'Key')}
        {text('scripture', 'Bible references', 'Passages the hymn draws on')}
        {text('hymnal', 'Hymnal and number', 'For example LSB 656; RUF Hymnbook')}
        <label>
          Used for
          <span className="muted">Seasons and parts of the service, separated by semicolons</span>
          <input value={usage} onChange={(e) => setUsage(e.target.value)} />
        </label>
        <label>
          Themes
          <span className="muted">Separated by semicolons</span>
          <input value={themes} onChange={(e) => setThemes(e.target.value)} />
        </label>
        {text('copyright', 'Copyright')}
        <fieldset className="wide-field">
          <legend>Where the music is</legend>
          <p className="muted">
            A Finale file, sheet music or slides: a web address, or where it is kept in your files.
          </p>
          {draft.files.map((f, i) => (
            <div className="scan-typed" key={i}>
              <select
                aria-label={`File ${i + 1} kind`}
                value={f.kind}
                onChange={(e) =>
                  set({
                    files: draft.files.map((x, j) =>
                      j === i ? { ...x, kind: e.target.value as typeof f.kind } : x,
                    ),
                  })
                }
              >
                {fileKinds.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
              <input
                aria-label={`File ${i + 1} location`}
                value={f.location}
                onChange={(e) =>
                  set({
                    files: draft.files.map((x, j) =>
                      j === i ? { ...x, location: e.target.value } : x,
                    ),
                  })
                }
              />
              <button
                type="button"
                onClick={() => set({ files: draft.files.filter((_, j) => j !== i) })}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set({ files: [...draft.files, { kind: 'Finale', location: '' }] })}
          >
            <Plus size={14} /> Add a file
          </button>
        </fieldset>
        <fieldset className="wide-field">
          <legend>Links</legend>
          <p className="muted">Hymnary.org, the RUF Hymnbook, a recording.</p>
          {draft.links.map((l, i) => (
            <div className="scan-typed" key={i}>
              <input
                aria-label={`Link ${i + 1} name`}
                placeholder="Name"
                value={l.label}
                onChange={(e) =>
                  set({
                    links: draft.links.map((x, j) =>
                      j === i ? { ...x, label: e.target.value } : x,
                    ),
                  })
                }
              />
              <input
                aria-label={`Link ${i + 1} address`}
                placeholder="https://…"
                value={l.url}
                onChange={(e) =>
                  set({
                    links: draft.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)),
                  })
                }
              />
              <button
                type="button"
                onClick={() => set({ links: draft.links.filter((_, j) => j !== i) })}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set({ links: [...draft.links, { label: '', url: '' }] })}
          >
            <Plus size={14} /> Add a link
          </button>
        </fieldset>
        <label className="wide-field">
          Words
          <textarea rows={8} value={draft.text} onChange={(e) => set({ text: e.target.value })} />
          <span className="muted">
            {draft.text.length.toLocaleString()} of {MAX_HYMN_TEXT.toLocaleString()} characters.
            Keep only words that are in the public domain or that you have permission to keep.
          </span>
        </label>
        <label className="wide-field">
          Notes
          <textarea rows={3} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
        </label>
        <div className="form-actions wide-field">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            Save hymn
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ListImport({
  library,
  onSave,
  onClose,
}: {
  library: Library
  onSave: (l: Library) => boolean
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<ReturnType<typeof mergeHymns> | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  function check(value: string) {
    setError('')
    setPreview(null)
    if (!value.trim()) return
    try {
      const parsed = parseHymnList(value)
      setWarnings(parsed.warnings)
      setPreview(mergeHymns(library, parsed.hymns))
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <Modal title="Import a hymn list" onClose={onClose} wide>
      <p>
        Paste a spreadsheet saved as CSV, or choose the file. The first row names the columns:{' '}
        <code>{HYMN_CSV_HEADERS}</code>. Only Title is required. Where a Finale file, sheet music or
        slides are kept goes in the Finale, Sheet music and Slides columns.
      </p>
      <label className="file-label">
        <Upload size={16} /> Choose a CSV file
        <input
          aria-label="Choose a hymn list file"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file)
              void file.text().then((t) => {
                setText(t)
                check(t)
              })
          }}
        />
      </label>
      <label>
        Hymn list
        <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <button onClick={() => check(text)}>Preview import</button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <section className="import-review">
          <p>
            {preview.added} to add; {preview.skipped} already in your catalog.
          </p>
          {warnings.length > 0 && (
            <details>
              <summary>{warnings.length} notes</summary>
              <ul>
                {warnings.slice(0, 30).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </details>
          )}
          <button
            className="primary"
            disabled={!preview.added}
            onClick={() => {
              if (onSave(preview.library)) onClose()
              else setError('Could not save.')
            }}
          >
            Import {preview.added} hymns
          </button>
        </section>
      )}
    </Modal>
  )
}

export function FilesImport({
  library,
  onSave,
  onClose,
}: {
  library: Library
  onSave: (l: Library) => boolean
  onClose: () => void
}) {
  const [plan, setPlan] = useState<FilePlan | null>(null)
  const [error, setError] = useState('')
  function choose(list: FileList | null) {
    setError('')
    const files = [...(list || [])]
      .filter((f) => !f.name.startsWith('~$') && !f.name.startsWith('.'))
      .map((f) => ({ name: f.name, path: f.webkitRelativePath || f.name }))
    if (!files.length) return setError('No files were found in that selection.')
    setPlan(planFiles(library, files))
  }
  const count = plan ? plan.attach.reduce((n, a) => n + a.files.length, 0) : 0
  return (
    <Modal title="Attach files from a folder" onClose={onClose} wide>
      <p>
        Choose the folder of Finale files, sheet music or slides. Each file is matched to a hymn by
        its name (a leading number is ignored). Files that match no hymn become new hymns so none is
        lost. Only the names and folders are recorded; your files are not uploaded or changed.
      </p>
      <div className="scan-typed">
        <label className="file-label">
          <Upload size={16} /> Choose a folder
          <input
            aria-label="Choose a folder of hymn files"
            type="file"
            // @ts-expect-error webkitdirectory is supported by every current browser
            webkitdirectory=""
            multiple
            onChange={(e) => {
              choose(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        <label className="file-label">
          <Upload size={16} /> Choose files
          <input
            aria-label="Choose hymn files"
            type="file"
            multiple
            onChange={(e) => {
              choose(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {plan && (
        <section className="import-review" aria-label="File matches">
          <p>
            {count} files to attach to {plan.attach.length} hymns; {plan.create.length} new hymns
            from unmatched files{plan.already ? `; ${plan.already} already recorded` : ''}.
          </p>
          <ul className="sermon-preview">
            {plan.attach.slice(0, 60).map((a) => (
              <li key={a.hymnId}>
                <strong>{a.title}</strong>
                <div className="muted">
                  {a.files.map((f) => `${f.kind}: ${f.location}`).join(' · ')}
                </div>
              </li>
            ))}
            {plan.create.slice(0, 60).map((c) => (
              <li key={c.title}>
                <strong>New: {c.title}</strong>
                <div className="muted">
                  {c.files.map((f) => `${f.kind}: ${f.location}`).join(' · ')}
                </div>
              </li>
            ))}
          </ul>
          <button
            className="primary"
            disabled={!count && !plan.create.length}
            onClick={() => {
              if (onSave(applyFilePlan(library, plan))) onClose()
              else setError('Could not save.')
            }}
          >
            Save these
          </button>
        </section>
      )}
    </Modal>
  )
}

export function Hymns({
  library,
  onSave,
  openId,
  setOpenId,
  onOpenLiturgy,
}: {
  library: Library
  onSave: (library: Library) => boolean
  openId: string
  setOpenId: (id: string) => void
  onOpenLiturgy: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [usage, setUsage] = useState('')
  const [hasFiles, setHasFiles] = useState(false)
  const [editing, setEditing] = useState<Hymn | null>(null)
  const [modal, setModal] = useState<'list' | 'files' | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [limit, setLimit] = useState(60)
  const hymns = library.hymns
  const usages = useMemo(() => allUsage(hymns), [hymns])
  const hits = useMemo(
    () => searchHymns(hymns, query, { usage, hasFiles }),
    [hymns, query, usage, hasFiles],
  )
  const open = hymns.find((h) => h.id === openId)
  const refs = useMemo(() => attachmentRefs(library), [library])
  const used = open ? liturgiesForHymn(library, open.id) : []
  return (
    <section className="sermons" aria-label="Hymns">
      {open ? (
        <article className="sermon-detail">
          <button
            onClick={() => {
              setOpenId('')
              setConfirm(false)
            }}
          >
            All hymns
          </button>
          <h1>{open.title}</h1>
          <p className="muted">{credit(open) || 'No credits recorded yet'}</p>
          <div className="sermon-actions">
            <button onClick={() => setEditing(open)}>Edit</button>
            {confirm ? (
              <>
                <span>Remove this hymn? Your files are not touched.</span>
                <button
                  onClick={() => {
                    if (onSave(deleteHymn(library, open.id))) {
                      removeUnused(library, open.attachments)
                      setOpenId('')
                    }
                  }}
                >
                  Yes, remove
                </button>
                <button onClick={() => setConfirm(false)}>Keep</button>
              </>
            ) : (
              <button onClick={() => setConfirm(true)}>Remove</button>
            )}
          </div>
          <dl className="sermon-facts">
            {facts(open)
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} style={{ display: 'contents' }}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          <section className="detail-section">
            <h3>Where to find it</h3>
            {open.files.length === 0 && open.links.length === 0 && (
              <p className="muted">No files or links recorded yet. Edit this hymn to add them.</p>
            )}
            {open.files.length > 0 && (
              <ul className="sermon-related">
                {open.files.map((f, i) => (
                  <li key={i}>
                    <strong>{f.kind}</strong> <Location value={f.location} />
                  </li>
                ))}
              </ul>
            )}
            <ul className="sermon-related">
              {open.links.map((l, i) => (
                <li key={i}>
                  <a href={l.url} target="_blank" rel="noreferrer">
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <a href={hymnarySearchUrl(open.title)} target="_blank" rel="noreferrer">
                  Look this hymn up on Hymnary.org
                </a>
              </li>
            </ul>
          </section>
          <Attachments
            refs={refs}
            attachments={open.attachments}
            onChange={(next) => onSave(saveHymn(library, { ...open, attachments: next }))}
          />
          {open.text && (
            <section className="detail-section">
              <h3>Words</h3>
              <pre className="manuscript note-body">{open.text}</pre>
            </section>
          )}
          {open.notes && (
            <section className="detail-section">
              <h3>Notes</h3>
              <p>{open.notes}</p>
            </section>
          )}
          {used.length > 0 && (
            <section className="detail-section">
              <h3>Used in liturgies</h3>
              <ul className="sermon-related">
                {used.map((l) => (
                  <li key={l.id}>
                    <button onClick={() => onOpenLiturgy(l.id)}>{l.title}</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      ) : (
        <>
          <header className="sermons-head">
            <div>
              <h1>Hymns</h1>
              <p className="muted">
                {hymns.length
                  ? `${hymns.length.toLocaleString()} hymns in your catalog`
                  : 'Composer, lyricist, meter, passages and usage, with where the Finale files, sheet music and slides are.'}
              </p>
            </div>
            <div className="sermon-actions">
              <button className="primary" onClick={() => setEditing(blankHymn())}>
                <Plus size={16} /> Add hymn
              </button>
              <button onClick={() => setModal('list')}>
                <Upload size={16} /> Import list
              </button>
              <button onClick={() => setModal('files')}>
                <Upload size={16} /> Attach files
              </button>
            </div>
          </header>
          <div className="search-bar">
            <Search size={20} />
            <input
              aria-label="Search hymns"
              placeholder="Title, first line, composer, tune, theme, or a passage (Psalm 23)..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setLimit(60)
              }}
            />
          </div>
          <div className="sermon-filters">
            <label>
              Used for
              <select value={usage} onChange={(e) => setUsage(e.target.value)}>
                <option value="">Anything</option>
                {usages.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={hasFiles}
                onChange={(e) => setHasFiles(e.target.checked)}
              />
              We have the files
            </label>
          </div>
          {query.trim() && (
            <p className="muted" role="status">
              {hits.length} {hits.length === 1 ? 'match' : 'matches'}.
            </p>
          )}
          {hymns.length === 0 ? (
            <div className="empty-state">
              <p>
                No hymns yet. Add one, import a spreadsheet, or attach a folder of Finale files.
              </p>
            </div>
          ) : hits.length === 0 ? (
            <p className="muted">Nothing matches.</p>
          ) : (
            <>
              <ul className="sermon-list">
                {hits.slice(0, limit).map(({ hymn, reasons }) => (
                  <li key={hymn.id}>
                    <button className="sermon-row" onClick={() => setOpenId(hymn.id)}>
                      <strong>{hymn.title}</strong>
                      <span className="muted">
                        {[credit(hymn), hymn.files.length ? 'Files on hand' : '']
                          .filter(Boolean)
                          .join(' · ') || 'No credits recorded'}
                      </span>
                      {reasons.length > 0 && (
                        <span className="sermon-reason">{reasons.join(' · ')}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              {hits.length > limit && (
                <button onClick={() => setLimit(limit + 60)}>
                  Show more ({hits.length - limit} left)
                </button>
              )}
            </>
          )}
        </>
      )}
      {editing && (
        <HymnEditor
          hymn={editing}
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
      {modal === 'list' && (
        <ListImport library={library} onSave={onSave} onClose={() => setModal(null)} />
      )}
      {modal === 'files' && (
        <FilesImport library={library} onSave={onSave} onClose={() => setModal(null)} />
      )}
    </section>
  )
}
