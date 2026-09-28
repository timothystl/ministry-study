import { useState, type FormEvent } from 'react'
import { lendBook, today, type Book, type Library } from '../lib/model'
import { Modal } from './Modal'
export function LoanForm({
  book,
  library,
  onSave,
  onClose,
}: {
  book: Book
  library: Library
  onSave: (library: Library) => boolean
  onClose: () => void
}) {
  const [borrower, setBorrower] = useState(''),
    [loanedAt, setLoanedAt] = useState(today()),
    [dueAt, setDueAt] = useState(''),
    [notes, setNotes] = useState(''),
    [error, setError] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    try {
      if (
        !onSave(
          lendBook(library, {
            id: crypto.randomUUID(),
            bookId: book.id,
            borrower: borrower.trim(),
            loanedAt,
            dueAt,
            returnedAt: '',
            notes,
          }),
        )
      )
        setError('Could not save the loan. Browser storage may be full or unavailable.')
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <Modal title="Loan a book" onClose={onClose}>
      <p>
        <strong>{book.title}</strong>
      </p>
      <form onSubmit={submit}>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <label>
          Loaned to
          <input
            autoFocus
            required
            value={borrower}
            onChange={(e) => setBorrower(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Loan date
            <input
              required
              type="date"
              max={today()}
              value={loanedAt}
              onChange={(e) => setLoanedAt(e.target.value)}
            />
          </label>
          <label>
            Due / check-in date (optional)
            <input
              type="date"
              min={loanedAt}
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </label>
        </div>
        <label>
          Loan notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary">Save loan</button>
        </div>
      </form>
    </Modal>
  )
}
