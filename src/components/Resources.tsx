import { useMemo, useState, type FormEvent } from 'react'
import { Plus, Search } from 'lucide-react'
import { attachmentRefs, removeUnused } from '../lib/attachments'
import { fileKinds } from '../lib/hymns'
import type { Library } from '../lib/model'
import {
  allTags,
  blankResource,
  deleteResource,
  resourceKinds,
  saveResource,
  searchResources,
  type Resource,
} from '../lib/resources'
import { Attachments } from './Attachments'
import { Location } from './Hymns'
import { Modal } from './Modal'

const byLine = (r: Resource) => [r.creator, r.year, r.place].filter(Boolean).join(' · ') || r.kind
const creatorLabel = (kind: Resource['kind']) =>
  kind === 'Article' || kind === 'Book' ? 'Author' : kind === 'Album' ? 'Artist or group' : 'By'

function ResourceEditor({
  resource,
  library,
  onSave,
  onClose,
}: {
  resource: Resource
  library: Library
  onSave: (library: Library) => boolean
  onClose: () => void
}) {
  const [draft, setDraft] = useState(resource)
  const [tags, setTags] = useState(resource.tags.join('; '))
  const [error, setError] = useState('')
  const set = (patch: Partial<Resource>) => setDraft({ ...draft, ...patch })
  function submit(e: FormEvent) {
    e.preventDefault()
    try {
      if (!onSave(saveResource(library, { ...draft, tags: tags.split(';') })))
        setError('Could not save. Your changes are still in this form.')
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <Modal
      title={resource.updatedAt ? 'Edit resource' : 'Add a music resource'}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="form-grid">
        {error && (
          <p role="alert" className="error wide-field">
            {error}
          </p>
        )}
        <label>
          Title or name
          <input value={draft.title} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label>
          Kind
          <select
            value={draft.kind}
            onChange={(e) => set({ kind: e.target.value as Resource['kind'] })}
          >
            {resourceKinds.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          {creatorLabel(draft.kind)}
          <input value={draft.creator} onChange={(e) => set({ creator: e.target.value })} />
        </label>
        <label>
          Year
          <input value={draft.year} onChange={(e) => set({ year: e.target.value })} />
        </label>
        <label>
          Place
          <input value={draft.place} onChange={(e) => set({ place: e.target.value })} />
        </label>
        <label>
          Web address
          <input
            type="url"
            placeholder="https://…"
            value={draft.link}
            onChange={(e) => set({ link: e.target.value })}
          />
        </label>
        <label className="wide-field">
          Tags
          <span className="muted">Separated by semicolons</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <fieldset className="wide-field">
          <legend>Copies in your own files</legend>
          <p className="muted">
            Downloaded albums, lead sheets, a saved article: where they are kept.
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
            onClick={() => set({ files: [...draft.files, { kind: 'Other', location: '' }] })}
          >
            <Plus size={14} /> Add a file
          </button>
        </fieldset>
        <label className="wide-field">
          Notes
          <textarea rows={4} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
        </label>
        <div className="form-actions wide-field">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            Save resource
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function Resources({
  library,
  onSave,
}: {
  library: Library
  onSave: (library: Library) => boolean
}) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('')
  const [tag, setTag] = useState('')
  const [openId, setOpenId] = useState('')
  const [editing, setEditing] = useState<Resource | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [limit, setLimit] = useState(60)
  const items = library.resources
  const tags = useMemo(() => allTags(items), [items])
  const hits = useMemo(
    () => searchResources(items, query, { kind, tag }),
    [items, query, kind, tag],
  )
  const open = items.find((r) => r.id === openId)
  const refs = useMemo(() => attachmentRefs(library), [library])
  return (
    <section className="sermons" aria-label="Music resources">
      {open ? (
        <article className="sermon-detail">
          <button
            onClick={() => {
              setOpenId('')
              setConfirm(false)
            }}
          >
            All resources
          </button>
          <h1>{open.title}</h1>
          <p className="muted">{[open.kind, byLine(open)].filter(Boolean).join(' · ')}</p>
          <div className="sermon-actions">
            <button onClick={() => setEditing(open)}>Edit</button>
            {confirm ? (
              <>
                <span>Remove this resource? Your own files are not touched.</span>
                <button
                  onClick={() => {
                    if (onSave(deleteResource(library, open.id))) {
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
          <section className="detail-section">
            <h3>Where to find it</h3>
            {!open.link && open.files.length === 0 && (
              <p className="muted">No link or file recorded yet. Edit this resource to add one.</p>
            )}
            <ul className="sermon-related">
              {open.link && (
                <li>
                  <a href={open.link} target="_blank" rel="noreferrer">
                    {open.link.length > 70 ? `${open.link.slice(0, 67)}…` : open.link}
                  </a>
                </li>
              )}
              {open.files.map((f, i) => (
                <li key={i}>
                  <strong>{f.kind}</strong> <Location value={f.location} />
                </li>
              ))}
            </ul>
          </section>
          {open.tags.length > 0 && <p className="muted">Tags: {open.tags.join(', ')}</p>}
          {open.notes && (
            <section className="detail-section">
              <h3>Notes</h3>
              <p>{open.notes}</p>
            </section>
          )}
          <Attachments
            refs={refs}
            attachments={open.attachments}
            onChange={(next) => onSave(saveResource(library, { ...open, attachments: next }))}
          />
        </article>
      ) : (
        <>
          <header className="sermons-head">
            <div>
              <h1>Music Resources</h1>
              <p className="muted">
                {items.length
                  ? `${items.length.toLocaleString()} resources`
                  : 'Artists, albums, articles, books and songbooks where hymns and songs are found.'}
              </p>
            </div>
            <div className="sermon-actions">
              <button className="primary" onClick={() => setEditing(blankResource())}>
                <Plus size={16} /> Add resource
              </button>
            </div>
          </header>
          <div className="search-bar">
            <Search size={20} />
            <input
              aria-label="Search resources"
              placeholder="Artist, album, author, place, tag…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setLimit(60)
              }}
            />
          </div>
          <div className="sermon-filters">
            <label>
              Kind
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">All kinds</option>
                {resourceKinds.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            {tags.length > 0 && (
              <label>
                Tag
                <select value={tag} onChange={(e) => setTag(e.target.value)}>
                  <option value="">Any tag</option>
                  {tags.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {(query.trim() || kind || tag) && (
            <p className="muted" role="status">
              {hits.length} {hits.length === 1 ? 'match' : 'matches'}.
            </p>
          )}
          {items.length === 0 ? (
            <div className="empty-state">
              <p>
                No resources yet. Add one as you use it, or bring in your Retuned Hymn Movement
                list.
              </p>
            </div>
          ) : hits.length === 0 ? (
            <p className="muted">Nothing matches.</p>
          ) : (
            <>
              <ul className="sermon-list">
                {hits.slice(0, limit).map((r) => (
                  <li key={r.id}>
                    <button className="sermon-row" onClick={() => setOpenId(r.id)}>
                      <strong>{r.title}</strong>
                      <span className="muted">
                        {[r.kind, byLine(r)].filter(Boolean).join(' · ')}
                      </span>
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
        <ResourceEditor
          resource={editing}
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
