import { useMemo, useState, type FormEvent } from 'react'
import { Camera, ExternalLink, Link2, Plus, Search, Upload } from 'lucide-react'
import type { Library } from '../lib/model'
import {
  blankNote,
  deleteNote,
  MAX_NOTE,
  noteFromFile,
  childrenKinds,
  devotionKinds,
  ideaKinds,
  isChildrensKind,
  isIdeaKind,
  markUsed,
  noteKinds,
  saveNote,
  searchNotes,
  type Note,
} from '../lib/notes'
import {
  attachFiles,
  attachmentRefs,
  REFERENCE_IMAGES,
  removeFile,
  removeUnused,
} from '../lib/attachments'
import { readManuscript } from '../lib/sermonText'
import { Attachments } from './Attachments'
import { isWebLink, noteFromLink } from '../lib/ideas'
import { IdeaSources, PasteLinks } from './IdeaSources'
import { Modal } from './Modal'

const dateLabel = (date: string) =>
  date
    ? new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''
const summary = (n: Note) =>
  [n.kind, n.scripture, dateLabel(n.date), n.personal ? 'Personal' : ''].filter(Boolean).join(' · ')
const today = () => new Date().toISOString().slice(0, 10)

export function NoteEditor({
  note,
  library,
  onSave,
  onClose,
  kinds = noteKinds,
}: {
  note: Note
  library: Library
  onSave: (library: Library) => boolean
  onClose: () => void
  kinds?: readonly Note['kind'][]
}) {
  const [draft, setDraft] = useState(note)
  const [tags, setTags] = useState(note.tags.join('; '))
  const [error, setError] = useState('')
  const sermon = library.sermons.find((s) => s.id === draft.sermonId)
  const collected = isIdeaKind(draft.kind)
  // Files added in this form but never saved are deleted if the form is cancelled.
  function cancel() {
    const kept = new Set(note.attachments.map((a) => a.id))
    draft.attachments.filter((a) => !kept.has(a.id)).forEach((a) => void removeFile(a.id))
    onClose()
  }
  function submit(e: FormEvent) {
    e.preventDefault()
    try {
      if (!onSave(saveNote(library, { ...draft, tags: tags.split(';') }))) {
        setError('Could not save. Your changes are still in this form.')
        return
      }
      const now = new Set(draft.attachments.map((a) => a.id))
      note.attachments.filter((a) => !now.has(a.id)).forEach((a) => void removeFile(a.id))
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <Modal
      title={
        note.updatedAt
          ? 'Edit'
          : isChildrensKind(note.kind)
            ? 'Add a children’s message'
            : isIdeaKind(note.kind)
              ? 'Add an illustration or idea'
              : 'Add a devotion or note'
      }
      onClose={cancel}
      wide
    >
      <form onSubmit={submit} className="form-grid">
        <label>
          Title
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
        <label>
          Kind
          <select
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value as Note['kind'] })}
          >
            {kinds.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Scripture
          <span className="muted">Notes on the same passage turn up with its sermons.</span>
          <input
            value={draft.scripture}
            onChange={(e) => setDraft({ ...draft, scripture: e.target.value })}
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
          Text
          <textarea
            rows={10}
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
          <span className="muted">
            {draft.body.length.toLocaleString()} of {MAX_NOTE.toLocaleString()} characters. A
            finished sermon belongs in Sermons → Manuscripts.
          </span>
        </label>
        <label className="wide-field">
          Tags (separate with semicolons)
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        {collected && (
          <>
            <label className="wide-field">
              Where it came from
              <span className="muted">
                A book and page, a link, a person, “overheard,” “my own.”
              </span>
              <input
                value={draft.source}
                onChange={(e) => setDraft({ ...draft, source: e.target.value })}
              />
            </label>
            <label className="wide-field check-row">
              <input
                type="checkbox"
                checked={draft.personal}
                onChange={(e) => setDraft({ ...draft, personal: e.target.checked })}
              />{' '}
              Personal or pastoral: about real people, keep it private
            </label>
            <div className="wide-field">
              <Attachments
                reference
                heading="Photos of handwritten notes or pages"
                attachments={draft.attachments}
                refs={new Map(note.attachments.map((a) => [a.id, 2]))}
                onChange={(next) => {
                  setDraft({ ...draft, attachments: next })
                  return true
                }}
              />
            </div>
          </>
        )}
        {sermon && (
          <p className="wide-field">
            Tied to the sermon “{sermon.title}”.{' '}
            <button type="button" onClick={() => setDraft({ ...draft, sermonId: '' })}>
              Untie
            </button>
          </p>
        )}
        {error && (
          <p className="error wide-field" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions wide-field">
          <button type="button" onClick={cancel}>
            Cancel
          </button>
          <button className="primary" type="submit">
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}

function NoteImport({
  library,
  onSave,
  onClose,
  kinds,
  kidsPage,
}: {
  library: Library
  onSave: (l: Library) => boolean
  onClose: () => void
  kinds: readonly Note['kind'][]
  kidsPage: boolean
}) {
  const [kind, setKind] = useState<Note['kind']>(kinds[0])
  const [ready, setReady] = useState<Note[]>([])
  const [skipped, setSkipped] = useState<string[]>([])
  const [error, setError] = useState('')
  async function choose(list: FileList | null) {
    setError('')
    const files = [...(list || [])].filter(
      (f) => /\.(docx|txt|md)$/i.test(f.name) && !f.name.startsWith('~$'),
    )
    if (!files.length)
      return setError('No Word, text or Markdown files were found in that selection.')
    const notes: Note[] = []
    const bad: string[] = []
    const have = new Set(library.notes.map((n) => n.source))
    for (const file of files) {
      try {
        const { text } = await readManuscript(file)
        if (text.length > MAX_NOTE) throw new Error('too long for a note')
        const n = noteFromFile(text, file.name, kind)
        if (have.has(n.source)) bad.push(`${file.name}: already imported`)
        else notes.push(n)
      } catch (e) {
        bad.push(`${file.name}: ${(e as Error).message}`)
      }
    }
    setReady(notes)
    setSkipped(bad)
  }
  return (
    <Modal
      title={
        kidsPage
          ? 'Import children’s messages from files'
          : 'Import devotions, notes or ideas from files'
      }
      onClose={onClose}
      wide
    >
      <p>
        Choose Word, text or Markdown files; each file becomes one note. A date and a passage at the
        start of a file name (such as “2025-12-03 Isa 64 Waiting.docx”) fill in the date and
        Scripture. Files are read in your browser and your originals are not changed. Longer than{' '}
        {MAX_NOTE.toLocaleString()} characters is skipped: finished sermons belong in Sermons.
      </p>
      <label>
        These are
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as Note['kind'])
            setReady([])
          }}
        >
          {kinds.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      <div className="scan-typed">
        <label className="file-label">
          <Upload size={16} /> Choose a folder
          <input
            aria-label="Choose a folder of notes"
            type="file"
            // @ts-expect-error webkitdirectory is supported by every current browser
            webkitdirectory=""
            multiple
            onChange={(e) => {
              void choose(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        <label className="file-label">
          <Upload size={16} /> Choose files
          <input
            aria-label="Choose note files"
            type="file"
            multiple
            accept=".docx,.txt,.md"
            onChange={(e) => {
              void choose(e.target.files)
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
      {(ready.length > 0 || skipped.length > 0) && (
        <section className="import-review" aria-label="Note import preview">
          <p>
            {ready.length} to add
            {skipped.length ? `; ${skipped.length} skipped` : ''}.
          </p>
          {skipped.length > 0 && (
            <details>
              <summary>Skipped files</summary>
              <ul>
                {skipped.slice(0, 30).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </details>
          )}
          <ul className="sermon-preview">
            {ready.slice(0, 100).map((n) => (
              <li key={n.id}>
                <strong>{n.title}</strong>
                <div className="muted">
                  {[n.scripture, n.date].filter(Boolean).join(' · ') || 'No date or passage found'}
                </div>
              </li>
            ))}
          </ul>
          <button
            className="primary"
            disabled={!ready.length}
            onClick={() => {
              if (onSave({ ...library, notes: [...library.notes, ...ready] })) onClose()
              else setError('Could not save the notes.')
            }}
          >
            Import {ready.length} {kidsPage ? 'messages' : 'notes'}
          </button>
        </section>
      )}
    </Modal>
  )
}

// The same records serve two pages: devotions and working notes, and children's messages and
// chapel talks. Each page shows only its own kinds.
export function Notes({
  library,
  onSave,
  kidsPage = false,
  ideasPage = false,
  startQuery = '',
}: {
  library: Library
  onSave: (library: Library) => boolean
  kidsPage?: boolean
  ideasPage?: boolean
  startQuery?: string
}) {
  const kinds = kidsPage ? childrenKinds : ideasPage ? ideaKinds : devotionKinds
  const notes = useMemo(
    () =>
      library.notes.filter((n) =>
        kidsPage
          ? isChildrensKind(n.kind)
          : ideasPage
            ? isIdeaKind(n.kind)
            : !isChildrensKind(n.kind) && !isIdeaKind(n.kind),
      ),
    [library.notes, kidsPage, ideasPage],
  )
  const noun = kidsPage ? 'messages' : ideasPage ? 'items' : 'notes'
  const [query, setQuery] = useState(startQuery)
  const [kind, setKind] = useState('')
  const [use, setUse] = useState<'' | 'unused' | 'used'>('')
  const [quick, setQuick] = useState('')
  const [usedWhere, setUsedWhere] = useState('')
  const [usedDate, setUsedDate] = useState(today())
  const [usedError, setUsedError] = useState('')
  const [openId, setOpenId] = useState('')
  const [editing, setEditing] = useState<Note | null>(null)
  const [importing, setImporting] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [shooting, setShooting] = useState(false)
  const [photoError, setPhotoError] = useState('')
  // A photo taken on the page becomes a Scrap at once, so nothing is lost if the phone is put away.
  async function takePhoto(list: FileList | null) {
    const files = [...(list || [])]
    if (!files.length) return
    setShooting(true)
    setPhotoError('')
    const { added, errors } = await attachFiles(files, REFERENCE_IMAGES)
    if (added.length) {
      const scrap = { ...blankNote('Scrap'), attachments: added }
      if (onSave(saveNote(library, scrap))) setOpenId(scrap.id)
      else {
        errors.push('Could not save the photo.')
        await Promise.all(added.map((a) => removeFile(a.id)))
      }
    }
    setPhotoError(errors.join(' '))
    setShooting(false)
  }
  const [confirm, setConfirm] = useState(false)
  const [copied, setCopied] = useState(false)
  const hits = useMemo(() => searchNotes(notes, query, kind, use), [notes, query, kind, use])
  const refs = useMemo(() => attachmentRefs(library), [library])
  const open = library.notes.find((n) => n.id === openId)
  const sermon = open && library.sermons.find((s) => s.id === open.sermonId)
  return (
    <section
      className="sermons"
      aria-label={
        kidsPage
          ? 'Children’s messages'
          : ideasPage
            ? 'Illustrations and ideas'
            : 'Devotions and notes'
      }
    >
      {open ? (
        <article className="sermon-detail">
          <button
            onClick={() => {
              setOpenId('')
              setConfirm(false)
            }}
          >
            {kidsPage ? 'All messages' : ideasPage ? 'All items' : 'All notes'}
          </button>
          <h1>{open.title}</h1>
          <p className="muted">{summary(open) || 'No date or passage'}</p>
          {sermon && <p className="muted">Tied to the sermon “{sermon.title}”.</p>}
          {open.tags.length > 0 && <p className="muted">Tags: {open.tags.join(', ')}</p>}
          <div className="sermon-actions">
            <button onClick={() => setEditing(open)}>Edit</button>
            <button
              onClick={() =>
                void navigator.clipboard?.writeText(open.body).then(() => setCopied(true))
              }
            >
              {copied ? 'Copied' : 'Copy text'}
            </button>
            {confirm ? (
              <>
                <span>Remove this note?</span>
                <button
                  onClick={() => {
                    if (onSave(deleteNote(library, open.id))) {
                      removeUnused(
                        deleteNote(library, open.id),
                        open.attachments.filter((a) => (refs.get(a.id) || 0) <= 1),
                      )
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
          {open.source && !open.source.startsWith('Imported file:') && (
            <p className="muted">
              From:{' '}
              {isWebLink(open.source) ? (
                <a href={open.source} target="_blank" rel="noreferrer">
                  {open.source}
                </a>
              ) : (
                open.source
              )}
            </p>
          )}
          {open.body && <pre className="manuscript note-body">{open.body}</pre>}
          {isIdeaKind(open.kind) && (
            <>
              <Attachments
                reference
                heading="Photos and pages"
                attachments={open.attachments}
                refs={refs}
                onChange={(next) => onSave(saveNote(library, { ...open, attachments: next }))}
              />
              <section className="detail-section" aria-label="Where it has been used">
                <h3>Where it has been used</h3>
                {open.uses.length === 0 ? (
                  <p className="muted">Not used yet.</p>
                ) : (
                  <ul>
                    {open.uses.map((u, i) => (
                      <li key={`${u}-${i}`}>{u}</li>
                    ))}
                  </ul>
                )}
                <form
                  className="scan-typed"
                  onSubmit={(e) => {
                    e.preventDefault()
                    try {
                      if (onSave(saveNote(library, markUsed(open, usedWhere, usedDate)))) {
                        setUsedWhere('')
                        setUsedError('')
                      }
                    } catch (err) {
                      setUsedError((err as Error).message)
                    }
                  }}
                >
                  <label>
                    Date
                    <input
                      type="date"
                      value={usedDate}
                      onChange={(e) => setUsedDate(e.target.value)}
                    />
                  </label>
                  <label>
                    Sermon or place
                    <input
                      list="used-sermons"
                      value={usedWhere}
                      onChange={(e) => setUsedWhere(e.target.value)}
                    />
                  </label>
                  <datalist id="used-sermons">
                    {library.sermons.slice(0, 200).map((sm) => (
                      <option key={sm.id} value={sm.title} />
                    ))}
                  </datalist>
                  <button type="submit">Mark as used</button>
                </form>
                {usedError && (
                  <p className="error" role="alert">
                    {usedError}
                  </p>
                )}
              </section>
            </>
          )}
        </article>
      ) : (
        <>
          <header className="sermons-head">
            <div>
              <h1>
                {kidsPage
                  ? 'Children’s Messages'
                  : ideasPage
                    ? 'Illustrations & Ideas'
                    : 'Devotions & Notes'}
              </h1>
              <p className="muted">
                {notes.length
                  ? `${notes.length.toLocaleString()} ${noun}`
                  : kidsPage
                    ? 'Pre-K children’s messages and grade school chapel talks.'
                    : ideasPage
                      ? 'Stories, quotes, images, facts, half-ideas and photographed scraps.'
                      : 'Council and midweek devotions and sermon-preparation notes.'}
              </p>
            </div>
            <div className="sermon-actions">
              <button className="primary" onClick={() => setEditing(blankNote(kinds[0]))}>
                <Plus size={16} /> {kidsPage ? 'Add message' : ideasPage ? 'Add item' : 'Add note'}
              </button>
              {ideasPage && (
                <button onClick={() => setPasting(true)}>
                  <Link2 size={16} /> Paste links
                </button>
              )}
              {ideasPage && (
                <label className="file-label">
                  <Camera size={16} /> Take a photo
                  <input
                    aria-label="Take a photo of a scrap"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={shooting}
                    onChange={(e) => {
                      void takePhoto(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </label>
              )}
              <button onClick={() => setImporting(true)}>
                <Upload size={16} /> Import files
              </button>
              {!ideasPage && (
                <a
                  className="button-link"
                  href="https://claude.ai/artifact/RtpqpPoXsERRCdD8Wd2DxE"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={16} />{' '}
                  {kidsPage ? 'Write a message with Claude' : 'Write a devotion with Claude'}
                </a>
              )}
            </div>
          </header>
          {photoError && (
            <p className="error" role="alert">
              {photoError}
            </p>
          )}
          {shooting && <p role="status">Saving the photo…</p>}
          {ideasPage && (
            <form
              className="search-bar"
              aria-label="Quick add"
              onSubmit={(e) => {
                e.preventDefault()
                if (!quick.trim()) return
                const idea = isWebLink(quick)
                  ? noteFromLink(quick)
                  : { ...blankNote('Idea'), title: quick.trim() }
                if (onSave(saveNote(library, idea))) setQuick('')
              }}
            >
              <Plus size={20} />
              <input
                aria-label="Quick add an idea"
                placeholder="Catch an idea or paste a link, then press Enter..."
                value={quick}
                onChange={(e) => setQuick(e.target.value)}
              />
            </form>
          )}
          <div className="search-bar">
            <Search size={20} />
            <input
              aria-label={kidsPage ? 'Search messages' : 'Search notes'}
              placeholder="Search by words, or a passage (Isaiah 64)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="sermon-filters">
            <label>
              {kidsPage ? 'Audience' : 'Kind'}
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">{kidsPage ? 'All audiences' : 'All kinds'}</option>
                {kinds.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            {ideasPage && (
              <label>
                Use
                <select value={use} onChange={(e) => setUse(e.target.value as typeof use)}>
                  <option value="">Used or not</option>
                  <option value="unused">Not yet used</option>
                  <option value="used">Already used</option>
                </select>
              </label>
            )}
          </div>
          {ideasPage && <IdeaSources query={query} library={library} onSave={onSave} />}
          {query.trim() && (
            <p className="muted" role="status">
              {hits.length} {hits.length === 1 ? 'match' : 'matches'}.
            </p>
          )}
          {notes.length === 0 ? (
            <div className="empty-state">
              <p>
                {kidsPage
                  ? 'No children’s messages yet. Add one, or import a folder of them from your computer or OneDrive.'
                  : ideasPage
                    ? 'Nothing collected yet. Catch an idea in one line above, or photograph a handwritten scrap and sort it later.'
                    : 'No notes yet. Add one, or import a folder of devotions or notes from your computer or OneDrive.'}
              </p>
            </div>
          ) : hits.length === 0 ? (
            <p className="muted">Nothing matches.</p>
          ) : (
            <ul className="sermon-list">
              {hits.slice(0, 100).map(({ note, reasons }) => (
                <li key={note.id}>
                  <button className="sermon-row" onClick={() => setOpenId(note.id)}>
                    <strong>{note.title}</strong>
                    <span className="muted">
                      {summary(note) || 'No date or passage'}
                      {note.uses.length ? ` · Used ${note.uses.length}×` : ''}
                    </span>
                    {reasons.length > 0 && (
                      <span className="sermon-reason">{reasons.join(' · ')}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {editing && (
        <NoteEditor
          note={editing}
          kinds={
            isChildrensKind(editing.kind) ? childrenKinds : editing.sermonId ? noteKinds : kinds
          }
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
      {pasting && (
        <PasteLinks library={library} onSave={onSave} onClose={() => setPasting(false)} />
      )}
      {importing && (
        <NoteImport
          library={library}
          onSave={onSave}
          kinds={kinds}
          kidsPage={kidsPage}
          onClose={() => setImporting(false)}
        />
      )}
    </section>
  )
}
