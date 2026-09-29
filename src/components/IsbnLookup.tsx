import { useEffect, useRef, useState } from 'react'
import { coverSearchUrl } from '../lib/covers'
import {
  applyEditionIsbn,
  editionsUrl,
  isbnEditions,
  isbnWorks,
  type IsbnEdition,
  type IsbnWork,
} from '../lib/isbn'
import type { Book } from '../lib/model'
import { Modal } from './Modal'
export function IsbnLookup({
  book,
  onSave,
  onClose,
}: {
  book: Book
  onSave: (book: Book) => boolean
  onClose: () => void
}) {
  const [title, setTitle] = useState(book.title),
    [author, setAuthor] = useState(book.author)
  const [works, setWorks] = useState<IsbnWork[] | null>(null),
    [work, setWork] = useState<IsbnWork | null>(null)
  const [editions, setEditions] = useState<IsbnEdition[]>([]),
    [offset, setOffset] = useState(0),
    [total, setTotal] = useState(0)
  const [selection, setSelection] = useState<{ edition: IsbnEdition; isbn: string } | null>(null)
  const [confirmed, setConfirmed] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  async function load(url: string, receive: (data: unknown) => void) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    setSelection(null)
    setConfirmed(false)
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      })
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? 'Open Library is busy. Wait a moment and try again.'
            : 'Lookup unavailable. Try again, or enter the ISBN from the book in Edit.',
        )
      const data: unknown = await response.json()
      if (request.current === controller) receive(data)
    } catch (e) {
      if (request.current === controller)
        setError(
          controller.signal.aborted
            ? 'The lookup timed out. Please try again.'
            : (e as Error).message,
        )
    } finally {
      clearTimeout(timer)
      if (request.current === controller) setLoading(false)
    }
  }
  function search() {
    try {
      const url = coverSearchUrl('title', '', title, author)
      setWork(null)
      setEditions([])
      setWorks(null)
      void load(url, (data) => setWorks(isbnWorks(data)))
    } catch (e) {
      setError((e as Error).message)
    }
  }
  function showEditions(next: IsbnWork, start = 0) {
    setWork(next)
    setEditions([])
    setOffset(start)
    setTotal(0)
    void load(editionsUrl(next.key, start), (data) => {
      const parsed = isbnEditions(data)
      setEditions(parsed.editions)
      setTotal(parsed.total)
    })
  }
  function save() {
    if (!selection || !confirmed) return
    try {
      if (onSave(applyEditionIsbn(book, selection.edition, selection.isbn))) onClose()
      else setError('Could not save. Your selection is still here.')
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <Modal title="Find ISBN" wide onClose={onClose}>
      <p>
        Find the book, then compare editions with its copyright page. Only the ISBN will be changed;
        your other catalog details stay as recorded.
      </p>
      <p className="muted">
        Current ISBN: {book.isbn || 'Not recorded'}. Title and author searches are sent to Open
        Library.
      </p>
      <div className="form-grid">
        <label>
          ISBN search title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          ISBN search author
          <input value={author} onChange={(e) => setAuthor(e.target.value)} />
        </label>
      </div>
      <button disabled={loading} onClick={search}>
        Find matching books
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {loading && <p role="status">Looking up editions…</p>}
      {!work && works && (
        <div className="picker-list">
          {works.length ? (
            works.map((w) => (
              <button key={w.key} disabled={loading} onClick={() => showEditions(w)}>
                <strong>{w.title}</strong>
                <span>{w.author || 'Author not supplied'}</span>
                <small>View editions</small>
              </button>
            ))
          ) : (
            <p>No matches. Try fewer title words or omit the author.</p>
          )}
        </div>
      )}
      {work && (
        <section className="isbn-editions">
          <h3>{work.title}</h3>
          <p>{work.author}</p>
          <button
            disabled={loading}
            onClick={() => {
              setWork(null)
              setSelection(null)
              setConfirmed(false)
            }}
          >
            Back to matching books
          </button>
          {!loading && !editions.length && !error && (
            <p>No editions were returned. You can enter the ISBN manually in Edit book.</p>
          )}
          {editions.map((edition) => (
            <div className="verification-record" key={edition.key}>
              <h3>{edition.title}</h3>
              {edition.subtitle && <p>{edition.subtitle}</p>}
              <p>
                Publisher: {edition.publisher || 'Not supplied'} · Date:{' '}
                {edition.date || 'Not supplied'}
              </p>
              <p>
                Format: {edition.format || 'Not supplied'} · Edition:{' '}
                {edition.edition || 'Not supplied'} · Language:{' '}
                {edition.languages || 'Not supplied'}
              </p>
              <a href={`https://openlibrary.org${edition.key}`} target="_blank" rel="noreferrer">
                View edition source
              </a>
              <div className="verification-actions">
                {edition.isbns.map((isbn) => (
                  <button
                    key={isbn}
                    aria-pressed={selection?.edition.key === edition.key && selection.isbn === isbn}
                    onClick={() => {
                      setSelection({ edition, isbn })
                      setConfirmed(false)
                    }}
                  >
                    {isbn}
                  </button>
                ))}
              </div>
              {!edition.isbns.length && <p>No valid ISBN recorded for this edition.</p>}
            </div>
          ))}
          <div className="form-actions">
            <button
              disabled={loading || offset === 0}
              onClick={() => showEditions(work, Math.max(0, offset - 20))}
            >
              Previous editions
            </button>
            <button
              disabled={loading || offset + 20 >= total}
              onClick={() => showEditions(work, offset + 20)}
            >
              More editions
            </button>
          </div>
        </section>
      )}
      {selection && (
        <div className="cover-choice">
          <strong>Selected ISBN: {selection.isbn}</strong>
          <p>
            {selection.edition.title} · {selection.edition.publisher} · {selection.edition.date} ·{' '}
            {selection.edition.format}
          </p>
          {book.isbn && book.isbn !== selection.isbn && (
            <p>This will replace the current ISBN {book.isbn}.</p>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I checked this edition against my book.
          </label>
          <button className="primary" disabled={!confirmed || loading} onClick={save}>
            Save this ISBN
          </button>
        </div>
      )}
      <p className="muted">Older books may not have an ISBN. Uncertain matches can stay blank.</p>
    </Modal>
  )
}
