import { Plus, ClipboardPenLine, Check } from 'lucide-react'
import { type Library, type Book, today } from '../lib/model'
import { Cover } from './BookViews'
import { Rating } from './Rating'
export function ReadingTable({ books, onOpen }: { books: Book[]; onOpen: (b: Book) => void }) {
  return (
    <div className="table-scroll">
      <table className="records-table reading-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Date Read</th>
            <th>Source</th>
            <th>Owned</th>
            <th>Rating</th>
          </tr>
        </thead>
        <tbody>
          {books.map((b) => (
            <tr key={b.id}>
              <td>
                <button className="table-book" onClick={() => onOpen(b)}>
                  <Cover book={b} small />
                  <div>
                    <strong>{b.title}</strong>
                    <span>{b.author || 'Author not recorded'}</span>
                  </div>
                </button>
              </td>
              <td>
                {b.reading.finished || (b.reading.status === 'Reading' ? 'Currently reading' : '—')}
              </td>
              <td>{b.reading.source || (b.ownership === 'Owned' ? 'Own' : 'Not recorded')}</td>
              <td>{b.ownership === 'Owned' ? 'Yes' : 'No'}</td>
              <td>
                <Rating rating={b.reading.rating} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
export function LoansTable({
  library,
  history,
  onOpen,
  onReturn,
  onAdd,
}: {
  library: Library
  history: boolean
  onOpen: (b: Book) => void
  onReturn: (id: string) => void
  onAdd: () => void
}) {
  const loans = library.loans.filter((l) => (history ? Boolean(l.returnedAt) : !l.returnedAt))
  return (
    <>
      <div className="table-scroll">
        <table className="records-table loans-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Loaned To</th>
              <th>Date</th>
              <th>{history ? 'Returned' : 'Due'}</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loans.map((l) => {
              const b = library.books.find((b) => b.id === l.bookId)!
              return (
                <tr key={l.id}>
                  <td>
                    <button className="table-book" onClick={() => onOpen(b)}>
                      <Cover book={b} small />
                      <div>
                        <strong>{b.title}</strong>
                        <span>{b.author}</span>
                      </div>
                    </button>
                  </td>
                  <td>{l.borrower}</td>
                  <td>{l.loanedAt}</td>
                  <td>{history ? l.returnedAt : l.dueAt || '—'}</td>
                  <td>
                    <span className={`loan-status ${history ? 'returned' : ''}`}>
                      {history ? 'Returned' : l.dueAt && l.dueAt < today() ? 'Overdue' : 'On Loan'}
                    </span>
                  </td>
                  <td>
                    {!history && (
                      <button className="return-button" onClick={() => onReturn(l.id)}>
                        <Check size={14} />
                        Return
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!loans.length && (
          <p className="table-empty">
            {history ? 'No returned loans yet.' : 'No books are currently out on loan.'}
          </p>
        )}
      </div>
      <div className="loan-callout">
        <ClipboardPenLine size={42} />
        <div>
          <h3>Keep good records, build deeper relationships.</h3>
          <p>Track the books you lend and the people you share them with.</p>
        </div>
        <button onClick={onAdd}>
          <Plus size={15} />
          Loan a Book
        </button>
      </div>
    </>
  )
}
