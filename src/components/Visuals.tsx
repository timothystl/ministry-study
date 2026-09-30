import { useMemo, useState, type FormEvent } from 'react'
import { ExternalLink, Play, Plus, Search } from 'lucide-react'
import {
  attachmentRefs,
  attachmentUrl,
  isImageAttachment,
  removeFile,
  removeUnused,
} from '../lib/attachments'
import type { Library } from '../lib/model'
import {
  blankVisual,
  creditLine,
  deleteVisual,
  embedUrl,
  isCleared,
  isWebLink,
  licenses,
  parseVideo,
  saveVisual,
  searchVisuals,
  thumbnailUrl,
  useForOptions,
  visualFromLink,
  visualKinds,
  visualSources,
  type Visual,
} from '../lib/visuals'
import { Attachments } from './Attachments'
import { Modal } from './Modal'

const thumbOf = (v: Visual) => {
  const photo = v.attachments.find(isImageAttachment)
  if (photo) return attachmentUrl(photo.id)
  const video = parseVideo(v.link)
  return video ? thumbnailUrl(video) : ''
}
const summary = (v: Visual) =>
  [v.kind, v.license, v.scripture, v.personal ? 'Personal' : ''].filter(Boolean).join(' · ')

function VisualEditor({
  visual,
  library,
  onSave,
  onClose,
}: {
  visual: Visual
  library: Library
  onSave: (library: Library) => boolean
  onClose: () => void
}) {
  const [draft, setDraft] = useState(visual)
  const [tags, setTags] = useState(visual.tags.join('; '))
  const [error, setError] = useState('')
  const clip = draft.kind === 'Clip'
  const set = <K extends keyof Visual>(key: K, value: Visual[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))
  // Files added in this form but never saved are deleted if the form is cancelled.
  function cancel() {
    const kept = new Set(visual.attachments.map((a) => a.id))
    draft.attachments.filter((a) => !kept.has(a.id)).forEach((a) => void removeFile(a.id))
    onClose()
  }
  function submit(e: FormEvent) {
    e.preventDefault()
    try {
      if (!onSave(saveVisual(library, { ...draft, tags: tags.split(';') }))) {
        setError('Could not save. Your changes are still in this form.')
        return
      }
      const now = new Set(draft.attachments.map((a) => a.id))
      visual.attachments.filter((a) => !now.has(a.id)).forEach((a) => void removeFile(a.id))
    } catch (err) {
      setError((err as Error).message)
    }
  }
  const illustrations = library.notes.filter((n) => n.kind !== 'Devotion').slice(0, 300)
  return (
    <Modal title={visual.updatedAt ? 'Edit' : 'Add an image or clip'} onClose={cancel} wide>
      <form onSubmit={submit} className="form-grid">
        <label>
          Title
          <input value={draft.title} onChange={(e) => set('title', e.target.value)} />
        </label>
        <label>
          Kind
          <select
            value={draft.kind}
            onChange={(e) => set('kind', e.target.value as Visual['kind'])}
          >
            {visualKinds.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className="wide-field">
          Link to the image or video
          <span className="muted">
            The better copy lives there; the study keeps only a small reference photo.
          </span>
          <input inputMode="url" value={draft.link} onChange={(e) => set('link', e.target.value)} />
        </label>
        <label>
          Made by
          <input value={draft.creator} onChange={(e) => set('creator', e.target.value)} />
        </label>
        <label>
          License
          <select
            value={draft.license}
            onChange={(e) => set('license', e.target.value as Visual['license'])}
          >
            {licenses.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label className="wide-field">
          Credit line
          <span className="muted">Leave blank to build one from the title, maker and license.</span>
          <input value={draft.credit} onChange={(e) => set('credit', e.target.value)} />
        </label>
        <label>
          Scripture
          <input value={draft.scripture} onChange={(e) => set('scripture', e.target.value)} />
        </label>
        <label>
          Tags (separate with semicolons)
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <fieldset className="wide-field">
          <legend>Use for</legend>
          {useForOptions.map((u) => (
            <label key={u} className="check-row">
              <input
                type="checkbox"
                checked={draft.useFor.includes(u)}
                onChange={(e) =>
                  set(
                    'useFor',
                    e.target.checked ? [...draft.useFor, u] : draft.useFor.filter((x) => x !== u),
                  )
                }
              />{' '}
              {u}
            </label>
          ))}
        </fieldset>
        {clip && (
          <>
            <label>
              Starts at
              <input
                placeholder="1:05"
                value={draft.start}
                onChange={(e) => set('start', e.target.value)}
              />
            </label>
            <label>
              Ends at
              <input
                placeholder="2:30"
                value={draft.end}
                onChange={(e) => set('end', e.target.value)}
              />
            </label>
            <label className="wide-field">
              What happens in the clip
              <textarea
                rows={3}
                value={draft.happens}
                onChange={(e) => set('happens', e.target.value)}
              />
            </label>
            <label className="wide-field">
              Content note (language, violence, age suitability)
              <input
                value={draft.contentNote}
                onChange={(e) => set('contentNote', e.target.value)}
              />
            </label>
          </>
        )}
        <label className="wide-field">
          Why it is worth keeping
          <textarea rows={4} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>
        <label className="wide-field">
          Goes with an illustration
          <select value={draft.noteId} onChange={(e) => set('noteId', e.target.value)}>
            <option value="">None</option>
            {illustrations.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
        </label>
        <label className="wide-field check-row">
          <input
            type="checkbox"
            checked={draft.personal}
            onChange={(e) => set('personal', e.target.checked)}
          />{' '}
          Personal: shows real people (such as children or members); keep it private
        </label>
        <div className="wide-field">
          <Attachments
            reference
            heading="Reference photo"
            attachments={draft.attachments}
            refs={new Map(visual.attachments.map((a) => [a.id, 2]))}
            onChange={(next) => {
              set('attachments', next)
              return true
            }}
          />
        </div>
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

// Images and video clips: kept for reference, with the license beside each and, for a clip, the
// moment that matters. A YouTube or Vimeo clip plays in place, opening at its start time.
export function Visuals({
  library,
  onSave,
}: {
  library: Library
  onSave: (library: Library) => boolean
}) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('')
  const [license, setLicense] = useState('')
  const [useFor, setUseFor] = useState('')
  const [quick, setQuick] = useState('')
  const [openId, setOpenId] = useState('')
  const [editing, setEditing] = useState<Visual | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [copied, setCopied] = useState(false)
  const hits = useMemo(
    () => searchVisuals(library.visuals, query, { kind, license, useFor }),
    [library.visuals, query, kind, license, useFor],
  )
  const refs = useMemo(() => attachmentRefs(library), [library])
  const open = library.visuals.find((v) => v.id === openId)
  const video = open ? parseVideo(open.link) : null
  const q = query.trim()
  return (
    <section className="sermons" aria-label="Images and clips">
      {open ? (
        <article className="sermon-detail">
          <button
            onClick={() => {
              setOpenId('')
              setConfirm(false)
              setPlaying(false)
            }}
          >
            All images and clips
          </button>
          <h1>{open.title}</h1>
          <p className="muted">{summary(open)}</p>
          {!isCleared(open.license) && (
            <p role="note" className="error">
              Not cleared for display:{' '}
              {open.license === 'Unknown' ? 'the license is unknown' : 'this is for reference only'}
              . Do not put it on a slide, in the bulletin or online until you have checked.
            </p>
          )}
          <div className="sermon-actions">
            <button onClick={() => setEditing(open)}>Edit</button>
            <button
              onClick={() =>
                void navigator.clipboard?.writeText(creditLine(open)).then(() => setCopied(true))
              }
            >
              {copied ? 'Copied' : 'Copy credit line'}
            </button>
            {confirm ? (
              <>
                <span>Remove this?</span>
                <button
                  onClick={() => {
                    const next = deleteVisual(library, open.id)
                    if (onSave(next)) {
                      removeUnused(
                        next,
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
          {open.link && (
            <p>
              <a href={open.link} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> {open.link}
              </a>
            </p>
          )}
          {video && (
            <section aria-label="Player">
              {playing ? (
                <iframe
                  title={`Play ${open.title}`}
                  src={embedUrl(video, open.start, open.end)}
                  allow="encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  style={{ width: '100%', aspectRatio: '16 / 9', border: 0 }}
                />
              ) : (
                <button onClick={() => setPlaying(true)}>
                  <Play size={16} /> Play here
                  {open.start ? ` from ${open.start}` : ''}
                </button>
              )}
              <p className="muted">
                Plays from {video.site}, so nothing is loaded from there until you press play.
              </p>
            </section>
          )}
          <dl className="sermon-facts">
            {open.creator && (
              <>
                <dt>Made by</dt>
                <dd>{open.creator}</dd>
              </>
            )}
            {open.useFor.length > 0 && (
              <>
                <dt>Use for</dt>
                <dd>{open.useFor.join(', ')}</dd>
              </>
            )}
            {open.kind === 'Clip' && (open.start || open.end) && (
              <>
                <dt>Moment</dt>
                <dd>
                  {open.start || 'start'} to {open.end || 'end'}
                </dd>
              </>
            )}
            {open.happens && (
              <>
                <dt>What happens</dt>
                <dd>{open.happens}</dd>
              </>
            )}
            {open.contentNote && (
              <>
                <dt>Content note</dt>
                <dd>{open.contentNote}</dd>
              </>
            )}
            {open.noteId && library.notes.find((n) => n.id === open.noteId) && (
              <>
                <dt>Goes with</dt>
                <dd>{library.notes.find((n) => n.id === open.noteId)!.title}</dd>
              </>
            )}
            {open.tags.length > 0 && (
              <>
                <dt>Tags</dt>
                <dd>{open.tags.join(', ')}</dd>
              </>
            )}
          </dl>
          {open.notes && <pre className="manuscript note-body">{open.notes}</pre>}
          <Attachments
            reference
            heading="Reference photo"
            attachments={open.attachments}
            refs={refs}
            onChange={(next) => onSave(saveVisual(library, { ...open, attachments: next }))}
          />
        </article>
      ) : (
        <>
          <header className="sermons-head">
            <div>
              <h1>Images &amp; Clips</h1>
              <p className="muted">
                {library.visuals.length
                  ? `${library.visuals.length.toLocaleString()} kept`
                  : 'Images and video clips kept for reference, with their licenses and links.'}
              </p>
            </div>
            <div className="sermon-actions">
              <button className="primary" onClick={() => setEditing(blankVisual())}>
                <Plus size={16} /> Add image or clip
              </button>
            </div>
          </header>
          <form
            className="search-bar"
            aria-label="Quick add"
            onSubmit={(e) => {
              e.preventDefault()
              const text = quick.trim()
              if (!text) return
              const v = isWebLink(text) ? visualFromLink(text) : { ...blankVisual(), title: text }
              // A video link needs a title of its own to be found later.
              if (!v.title) return setEditing(v)
              if (onSave(saveVisual(library, v))) setQuick('')
            }}
          >
            <Plus size={20} />
            <input
              aria-label="Quick add an image or clip"
              placeholder="Paste a link to an image or video, or type a title, then press Enter..."
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
            />
          </form>
          <div className="search-bar">
            <Search size={20} />
            <input
              aria-label="Search images and clips"
              placeholder="Search by words, or a passage (Luke 15)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="sermon-filters">
            <label>
              Kind
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">All kinds</option>
                {visualKinds.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label>
              License
              <select value={license} onChange={(e) => setLicense(e.target.value)}>
                <option value="">Any license</option>
                {licenses.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <label>
              Use for
              <select value={useFor} onChange={(e) => setUseFor(e.target.value)}>
                <option value="">Any use</option>
                {useForOptions.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
          </div>
          <details className="detail-section" aria-label="Look for images and clips elsewhere">
            <summary>Look elsewhere{q ? ` for “${q}”` : ''}</summary>
            <p className="muted">
              Opens a search in a new tab. Paste the link back here and set its license.
            </p>
            <ul className="idea-sources">
              {visualSources.map((s) => (
                <li key={s.name}>
                  <a href={s.url(q)} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} /> {s.name}
                  </a>{' '}
                  <span className="muted">{s.note}</span>
                </li>
              ))}
            </ul>
          </details>
          {q && (
            <p className="muted" role="status">
              {hits.length} {hits.length === 1 ? 'match' : 'matches'}.
            </p>
          )}
          {library.visuals.length === 0 ? (
            <div className="empty-state">
              <p>
                Nothing kept yet. Paste a link to an image or a video above, or add one with its
                license and a note about why it is worth keeping.
              </p>
            </div>
          ) : hits.length === 0 ? (
            <p className="muted">Nothing matches.</p>
          ) : (
            <ul className="sermon-list">
              {hits.slice(0, 100).map(({ visual, reasons }) => (
                <li key={visual.id}>
                  <button className="sermon-row" onClick={() => setOpenId(visual.id)}>
                    {thumbOf(visual) && (
                      <img
                        src={thumbOf(visual)}
                        alt=""
                        loading="lazy"
                        style={{ width: 96, height: 60, objectFit: 'cover', borderRadius: 4 }}
                      />
                    )}
                    <strong>{visual.title}</strong>
                    <span className="muted">{summary(visual)}</span>
                    {!isCleared(visual.license) && (
                      <span className="sermon-reason">Not cleared for display</span>
                    )}
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
        <VisualEditor
          visual={editing}
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
