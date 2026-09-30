import { useMemo, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Copy, Plus, Printer, Search, Upload } from 'lucide-react'
import { attachmentRefs, attachmentUrl, isImageAttachment, removeUnused } from '../lib/attachments'
import {
  blankItem,
  blankLiturgy,
  copyLiturgy,
  deleteLiturgy,
  liturgyToText,
  MAX_PART_TEXT,
  fileKindFor,
  fileKinds,
  itemKinds,
  liturgyKinds,
  moveItem,
  saveLiturgy,
  searchLiturgies,
  sortHymns,
  type Liturgy,
} from '../lib/hymns'
import type { Library } from '../lib/model'
import { Attachments } from './Attachments'
import { Location } from './Hymns'
import { Modal } from './Modal'

const dateLabel = (date: string) =>
  date
    ? new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''
const summary = (l: Liturgy) =>
  [l.kind, l.season, dateLabel(l.date), `${l.items.length} items`].filter(Boolean).join(' · ')

function LiturgyEditor({
  liturgy,
  library,
  onSave,
  onClose,
}: {
  liturgy: Liturgy
  library: Library
  onSave: (library: Library) => boolean
  onClose: () => void
}) {
  const [draft, setDraft] = useState(liturgy)
  const [error, setError] = useState('')
  const hymns = useMemo(() => sortHymns(library.hymns), [library.hymns])
  const set = (patch: Partial<Liturgy>) => setDraft({ ...draft, ...patch })
  const setItem = (i: number, patch: Partial<Liturgy['items'][number]>) =>
    set({ items: draft.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  function submit(e: FormEvent) {
    e.preventDefault()
    try {
      if (!onSave(saveLiturgy(library, draft)))
        setError('Could not save. Your changes are still in this form.')
    } catch (err) {
      setError((err as Error).message)
    }
  }
  function addFiles(list: FileList | null) {
    const picked = [...(list || [])]
      .filter((f) => !f.name.startsWith('~$'))
      .map((f) => ({ kind: fileKindFor(f.name), location: f.webkitRelativePath || f.name }))
    set({
      files: [
        ...draft.files,
        ...picked.filter((p) => !draft.files.some((x) => x.location === p.location)),
      ],
    })
  }
  return (
    <Modal title={liturgy.updatedAt ? 'Edit liturgy' : 'Add a liturgy'} onClose={onClose} wide>
      <form onSubmit={submit} className="form-grid">
        {error && (
          <p role="alert" className="error wide-field">
            {error}
          </p>
        )}
        <label>
          Title
          <input value={draft.title} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label>
          Kind
          <select
            value={draft.kind}
            onChange={(e) => set({ kind: e.target.value as Liturgy['kind'] })}
          >
            {liturgyKinds.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Season or day
          <input
            value={draft.season}
            placeholder="Advent 2, Lent, Reformation…"
            onChange={(e) => set({ season: e.target.value })}
          />
        </label>
        <label>
          Date
          <input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
        </label>
        <fieldset className="wide-field">
          <legend>The service, in order</legend>
          {draft.items.length === 0 && (
            <p className="muted">
              Add every part in order: hymns, readings, prayers, the liturgy’s own texts and music.
              Photos and PDFs of each part’s music are attached once the liturgy is saved.
            </p>
          )}
          {draft.items.map((item, i) => (
            <div className="liturgy-part-edit" key={item.id}>
              <div className="scan-typed">
                <select
                  aria-label={`Item ${i + 1} kind`}
                  value={item.kind}
                  onChange={(e) => setItem(i, { kind: e.target.value as typeof item.kind })}
                >
                  {itemKinds.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
                <input
                  aria-label={`Item ${i + 1} name`}
                  placeholder="Gathering hymn, Kyrie, Old Testament…"
                  value={item.label}
                  onChange={(e) => setItem(i, { label: e.target.value })}
                />
                <button
                  type="button"
                  aria-label={`Move item ${i + 1} up`}
                  disabled={i === 0}
                  onClick={() => set({ items: moveItem(draft.items, i, -1) })}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Move item ${i + 1} down`}
                  disabled={i === draft.items.length - 1}
                  onClick={() => set({ items: moveItem(draft.items, i, 1) })}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Remove item ${i + 1}`}
                  onClick={() => set({ items: draft.items.filter((_, j) => j !== i) })}
                >
                  Remove
                </button>
              </div>
              {item.kind === 'Hymn' && (
                <select
                  aria-label={`Item ${i + 1} hymn`}
                  value={item.hymnId}
                  onChange={(e) => setItem(i, { hymnId: e.target.value })}
                >
                  <option value="">Choose a hymn…</option>
                  {hymns.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.title}
                    </option>
                  ))}
                </select>
              )}
              {item.kind === 'Reading' && (
                <input
                  aria-label={`Item ${i + 1} passage`}
                  placeholder="Passage"
                  value={item.scripture}
                  onChange={(e) => setItem(i, { scripture: e.target.value })}
                />
              )}
              <textarea
                aria-label={`Item ${i + 1} text`}
                rows={item.kind === 'Hymn' ? 2 : 4}
                placeholder={
                  item.kind === 'Hymn'
                    ? 'Notes for this hymn (verses to sing, key)'
                    : 'The words of this part, in full'
                }
                value={item.text}
                onChange={(e) => setItem(i, { text: e.target.value })}
              />
              {item.text.length > MAX_PART_TEXT && (
                <p className="error" role="alert">
                  This part is too long.
                </p>
              )}
              {item.files.map((f, j) => (
                <div className="scan-typed" key={j}>
                  <select
                    aria-label={`Item ${i + 1} file ${j + 1} kind`}
                    value={f.kind}
                    onChange={(e) =>
                      setItem(i, {
                        files: item.files.map((x, k) =>
                          k === j ? { ...x, kind: e.target.value as typeof f.kind } : x,
                        ),
                      })
                    }
                  >
                    {fileKinds.map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                  <input
                    aria-label={`Item ${i + 1} file ${j + 1} location`}
                    value={f.location}
                    onChange={(e) =>
                      setItem(i, {
                        files: item.files.map((x, k) =>
                          k === j ? { ...x, location: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setItem(i, { files: item.files.filter((_, k) => k !== j) })}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setItem(i, { files: [...item.files, { kind: 'Finale', location: '' }] })
                }
              >
                <Plus size={14} /> Add a file for this part
              </button>
            </div>
          ))}
          <button type="button" onClick={() => set({ items: [...draft.items, blankItem()] })}>
            <Plus size={14} /> Add to the service
          </button>
        </fieldset>
        <fieldset className="wide-field">
          <legend>Files for the whole service</legend>
          <p className="muted">
            Slides (PowerPoint), the order of service, a bulletin. A web address, or where it is
            kept.
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
          <div className="scan-typed">
            <button
              type="button"
              onClick={() => set({ files: [...draft.files, { kind: 'Slides', location: '' }] })}
            >
              <Plus size={14} /> Add a file
            </button>
            <label className="file-label">
              <Upload size={16} /> Choose files
              <input
                aria-label="Choose liturgy files"
                type="file"
                multiple
                onChange={(e) => {
                  addFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        </fieldset>
        <label className="wide-field">
          Notes
          <textarea rows={3} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
        </label>
        <div className="form-actions wide-field">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            Save liturgy
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function Liturgies({
  library,
  onSave,
  openId,
  setOpenId,
  onOpenHymn,
}: {
  library: Library
  onSave: (library: Library) => boolean
  openId: string
  setOpenId: (id: string) => void
  onOpenHymn: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Liturgy | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [copied, setCopied] = useState(false)
  const refs = useMemo(() => attachmentRefs(library), [library])
  const list = useMemo(
    () => searchLiturgies(library.liturgies, library.hymns, query),
    [library.liturgies, library.hymns, query],
  )
  const open = library.liturgies.find((l) => l.id === openId)
  return (
    <section className="sermons" aria-label="Liturgies">
      {open ? (
        <article className="sermon-detail liturgy-whole">
          <button
            className="no-print"
            onClick={() => {
              setOpenId('')
              setConfirm(false)
            }}
          >
            All liturgies
          </button>
          <h1>{open.title}</h1>
          <p className="muted">{summary(open)}</p>
          <div className="sermon-actions no-print">
            <button onClick={() => setEditing(open)}>Edit</button>
            <button
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(liturgyToText(library, open))
                  .then(() => setCopied(true))
              }
            >
              <Copy size={14} /> {copied ? 'Copied' : 'Copy the whole service as text'}
            </button>
            <button onClick={() => window.print()}>
              <Printer size={14} /> Print
            </button>
            <button
              onClick={() => {
                const made = copyLiturgy(library, open.id)
                if (made && onSave(made.library)) setOpenId(made.liturgy.id)
              }}
            >
              Start a new service from this
            </button>
            {confirm ? (
              <>
                <span>Remove this liturgy? Your hymns and files are not touched.</span>
                <button
                  onClick={() => {
                    if (onSave(deleteLiturgy(library, open.id))) {
                      removeUnused(library, [
                        ...open.attachments,
                        ...open.items.flatMap((i) => i.attachments),
                      ])
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
          {open.items.length === 0 ? (
            <p className="muted">Nothing listed yet. Edit this liturgy to add its parts.</p>
          ) : (
            <ol className="liturgy-order">
              {open.items.map((item) => {
                const hymn = library.hymns.find((h) => h.id === item.hymnId)
                return (
                  <li key={item.id} className="liturgy-part">
                    <h3>{item.label || item.kind}</h3>
                    {item.kind === 'Hymn' &&
                      (hymn ? (
                        <>
                          <p>
                            <button className="no-print" onClick={() => onOpenHymn(hymn.id)}>
                              {hymn.title}
                            </button>
                            <span className="print-only">{hymn.title}</span>{' '}
                            <span className="muted">
                              {[hymn.hymnal, hymn.composer && `Music: ${hymn.composer}`]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </p>
                          {(hymn.attachments.length > 0 || hymn.files.length > 0) && (
                            <ul className="attachment-strip">
                              {hymn.attachments.map((a) => (
                                <li key={a.id}>
                                  <a href={attachmentUrl(a.id)} target="_blank" rel="noreferrer">
                                    {isImageAttachment(a) ? (
                                      <img src={attachmentUrl(a.id)} alt={a.name} loading="lazy" />
                                    ) : (
                                      a.name
                                    )}
                                  </a>
                                </li>
                              ))}
                              {hymn.files.map((f, i) => (
                                <li key={i}>
                                  <strong>{f.kind}</strong> <Location value={f.location} />
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      ) : (
                        <p className="muted">No hymn chosen</p>
                      ))}
                    {item.scripture && <p className="liturgy-passage">{item.scripture}</p>}
                    {item.text && <p className="liturgy-words">{item.text}</p>}
                    {item.kind === 'Hymn' && hymn?.text && !item.text && (
                      <p className="liturgy-words">{hymn.text}</p>
                    )}
                    {item.files.length > 0 && (
                      <ul className="sermon-related">
                        {item.files.map((f, i) => (
                          <li key={i}>
                            <strong>{f.kind}</strong> <Location value={f.location} />
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="no-print">
                      <Attachments
                        compact
                        heading="Music for this part"
                        refs={refs}
                        attachments={item.attachments}
                        onChange={(next) =>
                          onSave(
                            saveLiturgy(library, {
                              ...open,
                              items: open.items.map((x) =>
                                x.id === item.id ? { ...x, attachments: next } : x,
                              ),
                            }),
                          )
                        }
                      />
                    </div>
                    {item.attachments.length > 0 && (
                      <ul className="attachment-strip print-only">
                        {item.attachments.filter(isImageAttachment).map((a) => (
                          <li key={a.id}>
                            <img src={attachmentUrl(a.id)} alt={a.name} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
          <section className="detail-section no-print">
            <h3>Files for the whole service</h3>
            {open.files.length === 0 ? (
              <p className="muted">No slides or order of service recorded yet.</p>
            ) : (
              <ul className="sermon-related">
                {open.files.map((f, i) => (
                  <li key={i}>
                    <strong>{f.kind}</strong> <Location value={f.location} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="no-print">
            <Attachments
              heading="Photos and PDFs of the whole service"
              refs={refs}
              attachments={open.attachments}
              onChange={(next) => onSave(saveLiturgy(library, { ...open, attachments: next }))}
            />
          </div>
          {open.notes && (
            <section className="detail-section">
              <h3>Notes</h3>
              <p>{open.notes}</p>
            </section>
          )}
        </article>
      ) : (
        <>
          <header className="sermons-head">
            <div>
              <h1>Liturgies</h1>
              <p className="muted">
                {library.liturgies.length
                  ? `${library.liturgies.length.toLocaleString()} liturgies`
                  : 'Complete services and settings, kept whole: every part in order with its words, music and slides.'}
              </p>
            </div>
            <div className="sermon-actions">
              <button className="primary" onClick={() => setEditing(blankLiturgy())}>
                <Plus size={16} /> Add liturgy
              </button>
            </div>
          </header>
          <div className="search-bar">
            <Search size={20} />
            <input
              aria-label="Search liturgies"
              placeholder="Title, season, hymn, or words..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {library.liturgies.length === 0 ? (
            <div className="empty-state">
              <p>
                No liturgies yet. Add one to keep a whole service together: every part with its
                words, its music and its slides.
              </p>
            </div>
          ) : list.length === 0 ? (
            <p className="muted">Nothing matches.</p>
          ) : (
            <ul className="sermon-list">
              {list.slice(0, 100).map((l) => (
                <li key={l.id}>
                  <button className="sermon-row" onClick={() => setOpenId(l.id)}>
                    <strong>{l.title}</strong>
                    <span className="muted">{summary(l)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {editing && (
        <LiturgyEditor
          liturgy={editing}
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
    </section>
  )
}
