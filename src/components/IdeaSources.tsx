import { useState } from 'react'
import { ExternalLink, Link2, Trash2 } from 'lucide-react'
import type { Library } from '../lib/model'
import { addSource, allSources, homeUrl, parseLinks, searchUrl } from '../lib/ideas'
import { Modal } from './Modal'

// Where to look for illustrations: each link opens a search limited to that site, in a new tab.
// The built-in sites are fixed; sites added here are kept in the shared library.
export function IdeaSources({
  query,
  library,
  onSave,
}: {
  query: string
  library: Library
  onSave: (l: Library) => boolean
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')
  const q = query.trim()
  const custom = new Set(library.ideaSources.map((c) => c.id))
  return (
    <details className="detail-section" aria-label="Look for illustrations elsewhere">
      <summary>Look elsewhere{q ? ` for “${q}”` : ''}</summary>
      <p className="muted">
        Opens a search of that site in a new tab. Save what you find by pasting its link.
      </p>
      <ul className="idea-sources">
        {allSources(library.ideaSources).map((src) => (
          <li key={src.id}>
            <a href={searchUrl(src, query)} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> {q ? `Search ${src.name}` : src.name}
            </a>
            {q && (
              <>
                {' '}
                <a className="muted" href={homeUrl(src)} target="_blank" rel="noreferrer">
                  home
                </a>
              </>
            )}
            {custom.has(src.id) && (
              <button
                aria-label={`Remove ${src.name}`}
                onClick={() =>
                  onSave({
                    ...library,
                    ideaSources: library.ideaSources.filter((c) => c.id !== src.id),
                  })
                }
              >
                <Trash2 size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="scan-typed"
        onSubmit={(e) => {
          e.preventDefault()
          try {
            if (
              onSave({ ...library, ideaSources: addSource(library.ideaSources, name, address) })
            ) {
              setName('')
              setAddress('')
              setError('')
            }
          } catch (err) {
            setError((err as Error).message)
          }
        }}
      >
        <label>
          Site name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Web address
          <input
            placeholder="example.org or example.org/blog"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
        <button type="submit">Add a site</button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </details>
  )
}

// Paste links, one per line (a note may follow a "|"); each becomes an item that keeps its link.
export function PasteLinks({
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
  const { ready, skipped } = parseLinks(text, library.notes)
  return (
    <Modal title="Save links as illustrations" onClose={onClose} wide>
      <p>
        Paste web links, one per line. Add a note after a “|” if you like: “https://… | good for
        Lent 3”. Each link becomes an item with its title taken from the link; add the passage and
        your own words later. Only the link and your note are kept, not the page’s text.
      </p>
      <label>
        Links
        <textarea
          aria-label="Links"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {(ready.length > 0 || skipped.length > 0) && (
        <p role="status">
          {ready.length} to add{skipped.length ? `; ${skipped.length} skipped` : ''}.
        </p>
      )}
      {skipped.length > 0 && (
        <ul>
          {skipped.slice(0, 20).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
      {ready.length > 0 && (
        <ul className="sermon-preview">
          {ready.slice(0, 50).map((n) => (
            <li key={n.id}>
              <strong>{n.title}</strong>
              <div className="muted">{n.tags[0]}</div>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button onClick={onClose}>Cancel</button>
        <button
          className="primary"
          disabled={!ready.length}
          onClick={() => {
            if (onSave({ ...library, notes: [...library.notes, ...ready] })) onClose()
            else setError('Could not save the links.')
          }}
        >
          <Link2 size={16} /> Save {ready.length} {ready.length === 1 ? 'link' : 'links'}
        </button>
      </div>
    </Modal>
  )
}
