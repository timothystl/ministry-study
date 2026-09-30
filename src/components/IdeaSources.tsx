import { useState } from 'react'
import { ExternalLink, Link2 } from 'lucide-react'
import type { Library } from '../lib/model'
import { builtInSources, homeUrl, parseLinks, searchUrl } from '../lib/ideas'
import { Modal } from './Modal'

// Where to look for illustrations: each link opens a search limited to that site, in a new tab.
export function IdeaSources({ query }: { query: string }) {
  return (
    <section className="detail-section" aria-label="Look for illustrations elsewhere">
      <h3>Look elsewhere{query.trim() ? ` for “${query.trim()}”` : ''}</h3>
      <p className="muted">
        Opens a search of that site in a new tab. Save what you find by pasting its link.
      </p>
      <ul className="idea-sources">
        {builtInSources.map((s) => (
          <li key={s.site}>
            <a href={searchUrl(s, query)} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> {query.trim() ? `Search ${s.name}` : s.name}
            </a>{' '}
            {query.trim() && (
              <a className="muted" href={homeUrl(s)} target="_blank" rel="noreferrer">
                home
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
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
