import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Camera, CameraOff } from 'lucide-react'
import { cameraAvailable, startScanner } from '../lib/barcode'
import { isbnFromCode, lookupIsbn, type ScanResult } from '../lib/scan'
import { Modal } from './Modal'

// One scan for one book: the camera (or a typed ISBN) finds the book's details, and they are
// handed back to whoever asked. Used when adding a book and from a book's own page.
export function ScanIsbn({
  title = 'Scan the barcode',
  onFound,
  onClose,
}: {
  title?: string
  onFound: (result: ScanResult) => void
  onClose: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const busy = useRef(false)
  const [cameraError, setCameraError] = useState('')
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')
  const [looking, setLooking] = useState('')
  const lookup = useCallback(
    async (code: string) => {
      const isbn = isbnFromCode(code)
      if (!isbn) {
        setError('That does not look like a book barcode. Book barcodes start with 978 or 979.')
        return
      }
      if (busy.current) return
      busy.current = true
      setError('')
      setLooking(isbn)
      const result = await lookupIsbn(isbn)
      busy.current = false
      setLooking('')
      if (result) onFound(result)
      else setError(`No book information was found for ISBN ${isbn}. Try again, or type it in.`)
    },
    [onFound],
  )
  useEffect(() => {
    if (!cameraAvailable() || !video.current) return
    let stop: (() => void) | undefined
    let cancelled = false
    startScanner(video.current, (code) => {
      if (isbnFromCode(code)) void lookup(code)
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
  }, [lookup])
  function submit(e: FormEvent) {
    e.preventDefault()
    void lookup(typed)
  }
  return (
    <Modal title={title} wide onClose={onClose}>
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
        <button type="submit" disabled={!typed.trim() || Boolean(looking)}>
          Look up
        </button>
      </form>
      {looking && <p role="status">Looking up ISBN {looking}…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  )
}
