import { useState } from 'react'
import { locationLabel, today, type Book, type Library } from '../lib/model'
import { Modal } from './Modal'
export function VerifyBook({
  book,
  library,
  onSave,
  onClose,
  onEdit,
}: {
  book: Book
  library: Library
  onSave: (book: Book) => boolean
  onClose: () => void
  onEdit: () => void
}) {
  const [checked, setChecked] = useState<string[]>([])
  const [notes, setNotes] = useState(book.verification?.notes || '')
  const [error, setError] = useState('')
  const checks = [
    'Title and author match the physical book',
    'Edition, volume and ISBN match where available',
    'Current shelf location is correct',
  ]
  const metadata = book.sourceMetadata || {}
  function save(status: 'Confirmed' | 'Needs correction') {
    if (onSave({ ...book, verification: { status, checkedAt: today(), notes } })) onClose()
    else
      setError(
        'Could not save this check. Your review is still here; export a backup if browser storage is full.',
      )
  }
  return (
    <Modal title="Verify physical book" onClose={onClose}>
      <p>
        Compare this record with the book on your shelf. A matching cover alone does not confirm the
        edition.
      </p>
      <div className="verification-record">
        <h3>{book.title}</h3>
        {book.subtitle && <p>{book.subtitle}</p>}
        <p>{book.author || 'Author not recorded'}</p>
        <p>
          {[book.publisher, book.year, book.isbn && `ISBN ${book.isbn}`]
            .filter(Boolean)
            .join(' · ') || 'Publication details not recorded'}
        </p>
        <p>
          {[library.series.find((s) => s.id === book.seriesId)?.name, book.volume]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p>{locationLabel(book.location) || 'Location not recorded'}</p>
        {(book.edition ?? metadata.Edition) && <p>Edition: {book.edition ?? metadata.Edition}</p>}
      </div>
      {(metadata['Catalog Confidence'] || metadata['Review: Details']) && (
        <details open>
          <summary>Original catalog review</summary>
          <p>{metadata['Catalog Confidence']}</p>
          <p className="preserve">{metadata['Review: Details']}</p>
          <p className="preserve">{metadata['Current Location Notes']}</p>
        </details>
      )}
      <button type="button" onClick={onEdit}>
        Correct book details
      </button>
      <div className="verification-checks">
        {checks.map((label) => (
          <label className="check" key={label}>
            <input
              type="checkbox"
              checked={checked.includes(label)}
              onChange={(e) =>
                setChecked(
                  e.target.checked ? [...checked, label] : checked.filter((x) => x !== label),
                )
              }
            />
            {label}
          </label>
        ))}
      </div>
      <label>
        Verification notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Uncertain edition, missing volume, possible duplicate…"
        />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" onClick={() => save('Needs correction')}>
          Needs correction
        </button>
        <button
          type="button"
          className="primary"
          disabled={checked.length !== checks.length}
          onClick={() => save('Confirmed')}
        >
          Confirm this copy
        </button>
      </div>
    </Modal>
  )
}
