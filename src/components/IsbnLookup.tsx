import { useEffect, useRef, useState } from 'react'
import { coverSearchUrl, normalizeIsbn } from '../lib/covers'
import {
  applyEditionIsbn,
  editionFromRecord,
  editionsUrl,
  isbnEditions,
  isbnWorks,
  type IsbnEdition,
  type IsbnWork,
} from '../lib/isbn'
import type { Book } from '../lib/model'
import { lookupIsbn, toIsbn13 } from '../lib/scan'
import type { PublishedSummary } from '../lib/summary'
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
    [author, setAuthor] = useState(book.author),
    [isbnQuery, setIsbnQuery] = useState(book.isbn),
    [exact, setExact] = useState(false)
  const [badCovers, setBadCovers] = useState<string[]>([]),
    [goodCovers, setGoodCovers] = useState<string[]>([]),
    [withCover, setWithCover] = useState(true)
  const [summary, setSummary] = useState<PublishedSummary | 'none' | 'loading' | null>(null),
    [withSummary, setWithSummary] = useState(true)
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
    setBadCovers([])
    setGoodCovers([])
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      })
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? 'That ISBN was not found. Try the title and author.'
            : response.status === 429
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
  function search(byTitle = false) {
    try {
      const useIsbn = !byTitle && Boolean(isbnQuery.trim())
      const url = useIsbn
        ? coverSearchUrl('isbn', isbnQuery, '', '')
        : coverSearchUrl('title', '', title, author)
      setWork(null)
      setEditions([])
      setWorks(null)
      setExact(useIsbn)
      if (useIsbn)
        void load(url, (data) => {
          const edition = editionFromRecord(data, isbnQuery)
          if (!edition) throw new Error('That ISBN was not found. Try the title and author.')
          setWork({ key: '', title: edition.title, author: 'Your ISBN' })
          setEditions([edition])
          setTotal(1)
          setOffset(0)
        })
      else void load(url, (data) => setWorks(isbnWorks(data)))
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
  const coverShown = (edition: IsbnEdition) =>
    Boolean(edition.coverUrl) && !badCovers.includes(edition.key)
  function save() {
    if (!selection || !confirmed) return
    try {
      const cover = withCover && coverShown(selection.edition)
      const applied = applyEditionIsbn(book, selection.edition, selection.isbn, cover)
      const saved =
        withSummary && summary && typeof summary === 'object'
          ? {
              ...applied,
              summary: summary.text,
              sourceMetadata: {
                ...applied.sourceMetadata,
                'Summary source': `${summary.source} ${summary.url}`.trim(),
              },
            }
          : applied
      if (onSave(saved)) onClose()
      else setError('Could not save. Your selection is still here.')
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <Modal title="Find ISBN and cover" wide onClose={onClose}>
      <p>
        Find the book, then compare each edition’s ISBN and cover with your copy. Choosing an
        edition saves its ISBN, and its cover if you want it. Your other catalog details stay as
        recorded.
      </p>
      <p className="muted">
        Current ISBN: {book.isbn || 'Not recorded'}. What you type here is sent to Open Library.
      </p>
      <div className="form-grid">
        <label>
          ISBN search ISBN
          <span className="muted">
            Optional. If you know it, the exact edition and its cover appear.
          </span>
          <input value={isbnQuery} onChange={(e) => setIsbnQuery(e.target.value)} />
        </label>
        <label>
          ISBN search title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          ISBN search author
          <input value={author} onChange={(e) => setAuthor(e.target.value)} />
        </label>
      </div>
      <button disabled={loading} onClick={() => search()}>
        {isbnQuery.trim() && normalizeIsbn(isbnQuery) ? 'Find this edition' : 'Find matching books'}
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
              setSelection(null)
              setConfirmed(false)
              if (exact) search(true)
              else setWork(null)
            }}
          >
            {exact ? 'Search by title and author instead' : 'Back to matching books'}
          </button>
          {!loading && !editions.length && !error && (
            <p>No editions were returned. You can enter the ISBN manually in Edit book.</p>
          )}
          {editions.map((edition) => (
            <div className="verification-record edition-record" key={edition.key}>
              {edition.coverUrl && !badCovers.includes(edition.key) ? (
                <img
                  className="edition-cover"
                  src={edition.coverUrl}
                  alt={`Cover of ${edition.title}, ${edition.publisher || 'publisher not supplied'}`}
                  referrerPolicy="no-referrer"
                  onLoad={() => setGoodCovers((prev) => [...prev, edition.key])}
                  onError={() => setBadCovers((prev) => [...prev, edition.key])}
                />
              ) : (
                <span className="edition-cover missing">No cover available</span>
              )}
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
                      setSummary(null)
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
          {selection.edition.coverUrl && !badCovers.includes(selection.edition.key) && (
            <label className="check">
              <input
                type="checkbox"
                checked={withCover}
                disabled={!goodCovers.includes(selection.edition.key)}
                onChange={(e) => setWithCover(e.target.checked)}
              />
              Also use this edition’s cover
              {book.coverUrl &&
                !book.coverUrl.startsWith('/assets/') &&
                ' (replaces the current cover)'}
            </label>
          )}
          <p>
            {selection.edition.title} · {selection.edition.publisher} · {selection.edition.date} ·{' '}
            {selection.edition.format}
          </p>
          {book.isbn && book.isbn !== selection.isbn && (
            <p>This will replace the current ISBN {book.isbn}.</p>
          )}
          {summary === null && (
            <button
              onClick={() => {
                setSummary('loading')
                void lookupIsbn(toIsbn13(selection.isbn)).then((found) =>
                  setSummary(found?.summary ?? 'none'),
                )
              }}
            >
              Find a published summary
            </button>
          )}
          {summary === 'loading' && <p role="status">Looking for a summary…</p>}
          {summary === 'none' && (
            <p className="muted">No published summary was found for this ISBN.</p>
          )}
          {summary && typeof summary === 'object' && (
            <div className="scan-summary">
              <p>{summary.text}</p>
              <p className="muted">
                From{' '}
                {summary.url ? (
                  <a href={summary.url} target="_blank" rel="noreferrer">
                    {summary.source}
                  </a>
                ) : (
                  summary.source
                )}
                : the publisher’s or library’s wording, kept with its source.
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={withSummary}
                  onChange={(e) => setWithSummary(e.target.checked)}
                />
                Save this summary{book.summary ? ' (replaces your current summary)' : ''}
              </label>
            </div>
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
            {withCover &&
            coverShown(selection.edition) &&
            goodCovers.includes(selection.edition.key)
              ? 'Save ISBN and cover'
              : 'Save this ISBN'}
          </button>
        </div>
      )}
      <p className="muted">Older books may not have an ISBN. Uncertain matches can stay blank.</p>
    </Modal>
  )
}
