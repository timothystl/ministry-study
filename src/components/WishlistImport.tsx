import { useState } from 'react'
import { Upload } from 'lucide-react'
import { formats, type Book, type Library } from '../lib/model'
import {
  parseWishlistCsv,
  parseWishlistText,
  previewWishlist,
  type WishlistPreview,
} from '../lib/wishlist'
import { Modal } from './Modal'

export function WishlistImport({
  library,
  onSave,
  onClose,
}: {
  library: Library
  onSave: (next: Library) => boolean
  onClose: () => void
}) {
  const [mode, setMode] = useState<'paste' | 'csv'>('csv')
  const [text, setText] = useState('')
  const [filename, setFilename] = useState('')
  const [format, setFormat] = useState<Book['format']>('Physical')
  const [preview, setPreview] = useState<WishlistPreview | null>(null)
  const [error, setError] = useState('')
  function resetPreview() {
    setPreview(null)
    setError('')
  }
  async function read(file: File | undefined) {
    resetPreview()
    setText('')
    setFilename('')
    if (!file) return
    try {
      if (file.size > 2_000_000) throw new Error('Please choose a CSV smaller than 2 MB.')
      const input = await file.text()
      parseWishlistCsv(input)
      setText(input)
      setFilename(file.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this file.')
    }
  }
  return (
    <Modal title="Import wishlist" onClose={onClose} wide>
      <p>
        Bring in books you want to read or buy. New books will be marked Not owned. Existing books
        keep their ownership, reading status, notes, and location.
      </p>
      <div className="tabs" aria-label="Import source">
        <button
          className={mode === 'paste' ? 'selected' : ''}
          onClick={() => {
            setMode('paste')
            setText('')
            setFilename('')
            resetPreview()
          }}
        >
          Paste a list
        </button>
        <button
          className={mode === 'csv' ? 'selected' : ''}
          onClick={() => {
            setMode('csv')
            setText('')
            setFilename('')
            resetPreview()
          }}
        >
          CSV file
        </button>
      </div>
      {mode === 'paste' ? (
        <label>
          Books to import
          <span className="muted">One book per line: Title | Author. The author is optional.</span>
          <textarea
            rows={7}
            value={text}
            placeholder={'Surprised by Hope | N. T. Wright\nA book title'}
            onChange={(e) => {
              setText(e.target.value)
              resetPreview()
            }}
          />
        </label>
      ) : (
        <section className="detail-section">
          <p>
            Export your spreadsheet as CSV. Include a <strong>Title</strong> column; optional
            columns are Author, ISBN, Series, and Notes. Keep ISBN cells formatted as text.
          </p>
          <button
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob(['Title,Author,ISBN,Series,Notes\n'], { type: 'text/csv;charset=utf-8' }),
              )
              const anchor = document.createElement('a')
              anchor.href = url
              anchor.download = 'wishlist-template.csv'
              anchor.click()
              setTimeout(() => URL.revokeObjectURL(url), 1000)
            }}
          >
            Download CSV template
          </button>
          <label className="file-label">
            <Upload size={16} /> Choose wishlist CSV
            <input
              aria-label="Choose wishlist CSV"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                void read(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
          {filename && <p>{filename}</p>}
        </section>
      )}
      <label>
        Format for new books
        <select
          value={format}
          onChange={(e) => {
            setFormat(e.target.value as Book['format'])
            resetPreview()
          }}
        >
          {formats.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>
      <p className="muted">
        Matches use ISBN when available, otherwise title and author. Ambiguous matches are left for
        review. Nothing is saved until you confirm.
      </p>
      <button
        disabled={!text.trim()}
        onClick={() => {
          resetPreview()
          try {
            setPreview(
              previewWishlist(
                mode === 'csv' ? parseWishlistCsv(text) : parseWishlistText(text),
                library,
                format,
              ),
            )
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not preview this list.')
          }
        }}
      >
        Preview import
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <section className="import-review" aria-label="Wishlist import preview">
          <h3>Review your wishlist</h3>
          <p>
            {preview.added} new books; {preview.updated} existing books to add to your wishlist.
          </p>
          <ul>
            {preview.entries.map((entry, i) => (
              <li key={i}>
                <strong>{entry.title}</strong> — {entry.action}
              </li>
            ))}
          </ul>
          {preview.entries.some((entry) => entry.action === 'Needs review') && (
            <p>
              “Needs review” entries match multiple records and will be skipped. Add them
              individually after checking your library.
            </p>
          )}
          <button
            className="primary"
            disabled={!preview.added && !preview.updated}
            onClick={() => {
              if (!onSave(preview.library))
                setError(
                  'Could not save the wishlist. Browser storage may be full or unavailable. Your preview is still here.',
                )
            }}
          >
            Import {preview.added + preview.updated} books
          </button>
        </section>
      )}
    </Modal>
  )
}
