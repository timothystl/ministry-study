import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Camera, CameraOff } from 'lucide-react'
import { cameraAvailable, startScanner } from '../lib/barcode'
import { saveBook, type Book, type Library } from '../lib/model'
import {
  applyScan,
  isbnFromCode,
  lookupIsbn,
  matchBooks,
  newBookFromScan,
  type ScanResult,
} from '../lib/scan'
import { Modal } from './Modal'

type Step =
  | { kind: 'scanning' }
  | { kind: 'looking'; isbn: string }
  | { kind: 'result'; result: ScanResult }
  | { kind: 'missing'; isbn: string }
interface Tally {
  added: number
  updated: number
  skipped: number
}
// Scan a barcode (or type an ISBN), see the book with its cover and summary, and add it or match
// it to a book already in the library. After each book the camera is ready for the next.
export function ScanBook({
  library,
  onSave,
  onOpen,
  onClose,
}: {
  library: Library
  onSave: (library: Library) => boolean
  onOpen: (book: Book) => void
  onClose: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const [step, setStep] = useState<Step>({ kind: 'scanning' })
  const stepRef = useRef(step)
  useEffect(() => {
    stepRef.current = step
  }, [step])
  const [cameraError, setCameraError] = useState('')
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')
  const [useSummary, setUseSummary] = useState(true)
  const [tally, setTally] = useState<Tally>({ added: 0, updated: 0, skipped: 0 })
  const [last, setLast] = useState('')

  const lookup = useCallback(async (code: string) => {
    const isbn = isbnFromCode(code)
    if (!isbn) {
      setError('That does not look like a book barcode. Book barcodes start with 978 or 979.')
      return
    }
    setError('')
    setStep({ kind: 'looking', isbn })
    const result = await lookupIsbn(isbn)
    setUseSummary(true)
    setStep(result ? { kind: 'result', result } : { kind: 'missing', isbn })
  }, [])

  useEffect(() => {
    if (step.kind !== 'scanning' || !cameraAvailable() || !video.current) return
    let stop: (() => void) | undefined
    let cancelled = false
    startScanner(video.current, (code) => {
      if (stepRef.current.kind === 'scanning' && isbnFromCode(code)) void lookup(code)
    })
      .then((stopper) => {
        if (cancelled) stopper()
        else stop = stopper
      })
      .catch(() =>
        setCameraError(
          'The camera could not start. Allow camera access for this site, or type the ISBN below.',
        ),
      )
    return () => {
      cancelled = true
      stop?.()
    }
  }, [step.kind, lookup])

  function next(message: string, change: Partial<Tally>) {
    setTally((t) => ({
      added: t.added + (change.added || 0),
      updated: t.updated + (change.updated || 0),
      skipped: t.skipped + (change.skipped || 0),
    }))
    setLast(message)
    setStep({ kind: 'scanning' })
  }
  function commit(next: Library) {
    if (!onSave(next)) setError('Could not save. Nothing was changed.')
    return true
  }
  function addNew(result: ScanResult) {
    try {
      const book = newBookFromScan(result, useSummary)
      if (commit(saveBook(library, book, ''))) next(`Added “${result.title}”.`, { added: 1 })
    } catch (e) {
      setError((e as Error).message)
    }
  }
  function matchExisting(book: Book, result: ScanResult) {
    try {
      const updated = applyScan(book, result, {
        cover: !book.coverUrl || book.coverUrl.startsWith('/assets/'),
        summary: useSummary && !book.summary,
      })
      if (commit(saveBook(library, updated, series(book))))
        next(`Matched “${book.title}” and saved its ISBN.`, { updated: 1 })
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const series = (book: Book) => library.series.find((s) => s.id === book.seriesId)?.name || ''
  function submit(e: FormEvent) {
    e.preventDefault()
    void lookup(typed)
    setTyped('')
  }
  const matches = step.kind === 'result' ? matchBooks(library, step.result) : null
  return (
    <Modal title="Scan a book" wide onClose={onClose}>
      {step.kind === 'scanning' && (
        <>
          {cameraAvailable() && !cameraError ? (
            <div className="scan-frame">
              <video ref={video} playsInline muted aria-label="Camera view" />
              <p className="muted">
                <Camera size={14} /> Hold the book so the barcode on the back cover fills the box.
              </p>
            </div>
          ) : (
            <p className="muted">
              <CameraOff size={14} /> {cameraError || 'This browser cannot use the camera here.'}
            </p>
          )}
          {last && <p role="status">{last}</p>}
        </>
      )}
      <form onSubmit={submit} className="scan-typed">
        <label>
          Or type the ISBN
          <input
            inputMode="numeric"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="978…"
          />
        </label>
        <button type="submit" disabled={!typed.trim() || step.kind === 'looking'}>
          Look up
        </button>
      </form>
      {(tally.added > 0 || tally.updated > 0 || tally.skipped > 0) && (
        <p className="muted">
          This session: {tally.added} added, {tally.updated} matched, {tally.skipped} skipped.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {step.kind === 'looking' && <p role="status">Looking up ISBN {step.isbn}…</p>}
      {step.kind === 'missing' && (
        <section className="import-review">
          <p>
            No book information was found for ISBN {step.isbn}. You can add it by hand from Add
            Book, or scan another.
          </p>
          <button onClick={() => next('', { skipped: 1 })}>Scan next book</button>
        </section>
      )}
      {step.kind === 'result' && matches && (
        <section className="scan-result" aria-label="Scanned book">
          <div className="scan-book">
            {step.result.coverUrl ? (
              <img
                className="edition-cover"
                src={step.result.coverUrl}
                alt={`Cover of ${step.result.title}`}
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="edition-cover missing">No cover available</span>
            )}
            <div>
              <h3>{step.result.title}</h3>
              <p>{step.result.authors || 'Author not supplied'}</p>
              <p className="muted">
                {[step.result.publisher, step.result.year, `ISBN ${step.result.isbn}`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
          {step.result.summary && (
            <div className="scan-summary">
              <p>{step.result.summary.text}</p>
              <p className="muted">
                Published summary from{' '}
                {step.result.summary.url ? (
                  <a href={step.result.summary.url} target="_blank" rel="noreferrer">
                    {step.result.summary.source}
                  </a>
                ) : (
                  step.result.summary.source
                )}
                . It is the publisher’s or library’s wording, kept with its source.
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={useSummary}
                  onChange={(e) => setUseSummary(e.target.checked)}
                />
                Save this summary with the book
              </label>
            </div>
          )}
          {matches.sameIsbn.length > 0 && (
            <div>
              <h3>Already in your library</h3>
              {matches.sameIsbn.map((b) => (
                <p key={b.id}>
                  <button onClick={() => onOpen(b)}>{b.title}</button>{' '}
                  <span className="muted">{b.format}</span>
                </p>
              ))}
            </div>
          )}
          {matches.similar.length > 0 && (
            <div>
              <h3>Is this one of your books?</h3>
              <p className="muted">
                Saves the ISBN, and the cover and summary if the record has none. Nothing else
                changes.
              </p>
              {matches.similar.map((b) => (
                <p key={b.id}>
                  <button className="primary" onClick={() => matchExisting(b, step.result)}>
                    Yes: {b.title}
                  </button>{' '}
                  <span className="muted">
                    {[b.author, b.format, b.isbn && `ISBN ${b.isbn}`].filter(Boolean).join(' · ')}
                  </span>
                </p>
              ))}
            </div>
          )}
          <div className="form-actions">
            <button onClick={() => next('', { skipped: 1 })}>Skip, scan next</button>
            <button
              className={matches.sameIsbn.length || matches.similar.length ? '' : 'primary'}
              onClick={() => addNew(step.result)}
            >
              {matches.sameIsbn.length ? 'Add another copy' : 'Add as a new book'}
            </button>
          </div>
        </section>
      )}
    </Modal>
  )
}
