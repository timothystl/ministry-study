import { useEffect, useRef, useState } from 'react'
import type { Book } from '../lib/model'
import {
  coverSearchUrl,
  normalizeIsbn,
  parseCoverResults,
  type CoverCandidate,
} from '../lib/covers'
export function CoverSearch({
  book,
  onSelect,
}: {
  book: Book
  onSelect: (candidate: CoverCandidate) => void
}) {
  const [mode, setMode] = useState<'isbn' | 'title'>(normalizeIsbn(book.isbn) ? 'isbn' : 'title')
  const [isbn, setIsbn] = useState(book.isbn)
  const [title, setTitle] = useState(book.title)
  const [author, setAuthor] = useState(book.author)
  const [results, setResults] = useState<CoverCandidate[] | null>(null)
  const [selected, setSelected] = useState<CoverCandidate | null>(null)
  const [failed, setFailed] = useState<string[]>([])
  const [loaded, setLoaded] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  async function search() {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    setResults(null)
    setSelected(null)
    setFailed([])
    setLoaded([])
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch(coverSearchUrl(mode, isbn, title, author), {
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      })
      if (response.status === 404) {
        if (request.current === controller) setResults([])
        return
      }
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? 'Open Library is busy. Please wait a moment before trying again.'
            : 'Could not reach Open Library. Please try again or paste a cover image URL in Edit book.',
        )
      const candidates = parseCoverResults(
        await response.json(),
        mode === 'isbn' ? normalizeIsbn(isbn) : '',
      )
      if (request.current === controller) setResults(candidates)
    } catch (e) {
      if (request.current === controller)
        setError(
          controller.signal.aborted
            ? 'The search timed out. Please try again.'
            : (e as Error).message,
        )
    } finally {
      clearTimeout(timeout)
      if (request.current === controller) setLoading(false)
    }
  }
  return (
    <div className="cover-search">
      <p className="muted">
        Search Open Library by ISBN for your edition, or by title and author. Only these search
        fields are sent. Choosing a cover changes the image only.
      </p>
      <label>
        Search covers by
        <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
          <option value="isbn">ISBN</option>
          <option value="title">Title and author</option>
        </select>
      </label>
      {mode === 'isbn' ? (
        <label>
          Cover search ISBN
          <input
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            placeholder="ISBN from the copyright page"
          />
        </label>
      ) : (
        <div className="form-grid">
          <label>
            Cover search title
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Cover search author
            <input value={author} onChange={(e) => setAuthor(e.target.value)} />
          </label>
        </div>
      )}
      <button type="button" disabled={loading} onClick={search}>
        {loading ? 'Searching…' : 'Search Open Library'}
      </button>
      <div role="status">
        {loading
          ? 'Looking for covers…'
          : results
            ? `${results.length} cover candidate${results.length === 1 ? '' : 's'}`
            : ''}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {results?.length === 0 && (
        <p>
          No covers found. Try fewer title words, omit the author, or search by ISBN. You can also
          paste an HTTPS image URL in Edit book.
        </p>
      )}
      <div className="cover-candidates">
        {results?.map((candidate) => (
          <button
            type="button"
            key={candidate.id}
            className={`cover-candidate ${selected?.id === candidate.id ? 'selected' : ''}`}
            aria-pressed={selected?.id === candidate.id}
            disabled={failed.includes(candidate.id)}
            onClick={() => setSelected(candidate)}
          >
            {!failed.includes(candidate.id) && (
              <img
                src={candidate.imageUrl}
                alt={`Candidate cover: ${candidate.title}`}
                referrerPolicy="no-referrer"
                onLoad={() => setLoaded((prev) => [...prev, candidate.id])}
                onError={() => setFailed((prev) => [...prev, candidate.id])}
              />
            )}
            <strong>{candidate.title}</strong>
            <span>{candidate.author || 'Author not supplied'}</span>
            <small>{candidate.publication}</small>
            <small>
              {failed.includes(candidate.id)
                ? 'Image unavailable'
                : candidate.editionSpecific
                  ? `ISBN ${candidate.isbn}`
                  : 'Edition not verified'}
            </small>
          </button>
        ))}
      </div>
      {selected && (
        <div className="cover-choice">
          <p>
            <strong>{selected.title}</strong> — compare this cover with your copy.{' '}
            {selected.editionSpecific
              ? 'Check the ISBN and edition against the book.'
              : 'Title searches group editions; this cover may be from a different edition.'}
          </p>
          <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
            View on Open Library
          </a>
          <button
            type="button"
            className="primary"
            disabled={!loaded.includes(selected.id) || failed.includes(selected.id)}
            onClick={() => onSelect(selected)}
          >
            Use this cover
          </button>
        </div>
      )}
      <small>
        Cover images are hosted by{' '}
        <a href="https://openlibrary.org" target="_blank" rel="noreferrer">
          Open Library
        </a>
        .
      </small>
    </div>
  )
}
