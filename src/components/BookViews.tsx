import { useState } from 'react'
import { ArrowLeft, BookOpen, MapPin, ArrowUpRight, Pencil, CheckCircle2, Plus } from 'lucide-react'
import {
  activeLoan,
  locationLabel,
  readingStatuses,
  verificationStatus,
  type Book,
  type Library,
} from '../lib/model'
import { Rating } from './Rating'
import { CoverSearch } from './CoverSearch'
import { Modal } from './Modal'
import { VerifyBook } from './VerifyBook'
import { IsbnLookup } from './IsbnLookup'
export function Cover({ book, small = false }: { book: Book; small?: boolean }) {
  return (
    <img
      className={`cover ${small ? 'small' : ''}`}
      src={book.coverUrl || '/assets/unidentified-cover.png'}
      alt={book.coverUrl ? `${book.title} cover` : 'Cover not yet identified'}
      onError={(e) => {
        e.currentTarget.onerror = null
        e.currentTarget.src = '/assets/unidentified-cover.png'
      }}
    />
  )
}
export function BookCards({
  books,
  library,
  view,
  onOpen,
}: {
  books: Book[]
  library: Library
  view: 'grid' | 'list'
  onOpen: (book: Book) => void
}) {
  return (
    <div className={view === 'grid' ? 'book-grid' : 'book-list'}>
      {books.map((b) => (
        <button className="book-card" key={b.id} onClick={() => onOpen(b)}>
          <Cover book={b} small={view === 'list'} />
          <div className="book-info">
            <h3>{b.title}</h3>
            <p>{b.author || 'Author not recorded'}</p>
            <div className="book-tags">
              <span>{b.format}</span>
              <span>{activeLoan(library, b.id) ? 'Loaned out' : b.ownership}</span>
              {b.reading.status !== 'Not recorded' && <span>{b.reading.status}</span>}
              {b.license === 'Temporary' && <span>Temporary access</span>}
              {b.format === 'Physical' && <span>{verificationStatus(b)}</span>}
            </div>
            {b.format === 'Physical' && (
              <p className="location">
                <MapPin size={12} />
                {locationLabel(b.location) || 'Location not recorded'}
              </p>
            )}
          </div>
          {view === 'list' && <ArrowUpRight size={17} className="row-arrow" />}
        </button>
      ))}
    </div>
  )
}
export function BookDetail({
  book,
  library,
  onClose,
  onEdit,
  onLoan,
  onReturn,
  onUpdate,
  onOpen,
  nextToVerify,
}: {
  book: Book
  library: Library
  onClose: () => void
  onEdit: () => void
  onLoan: () => void
  onReturn: (id: string) => void
  onUpdate: (book: Book) => boolean
  onOpen: (book: Book) => void
  nextToVerify?: Book
}) {
  const [isbnOpen, setIsbnOpen] = useState(false)
  const [coverOpen, setCoverOpen] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [coverError, setCoverError] = useState('')
  const [tab, setTab] = useState('Overview')
  const loan = activeLoan(library, book.id),
    series = library.series.find((s) => s.id === book.seriesId),
    history = library.loans.filter((l) => l.bookId === book.id)
  const related = library.books
    .filter(
      (b) =>
        b.id !== book.id &&
        ((book.seriesId && b.seriesId === book.seriesId) ||
          b.topics.some((t) => book.topics.includes(t))),
    )
    .slice(0, 6)
  const readingRecorded = book.reading.status !== 'Not recorded'
  return (
    <article className="book-detail">
      <div className="detail-top">
        <button className="text-button" onClick={onClose}>
          <ArrowLeft size={16} />
          Back to library
        </button>
        <button onClick={onEdit}>
          <Pencil size={14} />
          Edit
        </button>
      </div>
      <section className="detail-hero">
        <div className="detail-cover">
          <Cover book={book} />
          <button
            onClick={() => {
              setCoverError('')
              setCoverOpen(true)
            }}
          >
            Find cover
          </button>
          {book.coverSource && (
            <a href={book.coverSource.url} target="_blank" rel="noreferrer">
              {book.coverSource.name}
            </a>
          )}
        </div>
        <div className="detail-heading">
          <h1>{book.title}</h1>
          {book.subtitle && <p className="subtitle">{book.subtitle}</p>}
          <p className="detail-author">{book.author || 'Author not recorded'}</p>
          <p className="publication">
            {[
              book.year,
              book.publisher,
              book.edition ?? book.sourceMetadata?.Edition,
              book.isbn && `ISBN ${book.isbn}`,
            ]
              .filter(Boolean)
              .join(' · ') || 'Publication details not recorded'}
          </p>
          <button onClick={() => setIsbnOpen(true)}>Find ISBN</button>
          <div className="book-tags">
            <span>{book.format}</span>
            {series && (
              <span>
                {series.name}
                {book.volume && ` · ${book.volume}`}
              </span>
            )}
            {book.license === 'Temporary' && <span>Temporary access</span>}
          </div>
          <div className="relationship-bar">
            <span className={`ownership-badge ${book.ownership === 'Owned' ? 'owned' : ''}`}>
              <CheckCircle2 size={20} />
              {book.ownership}
            </span>
            <label className="reading-select">
              <BookOpen size={19} />
              <select
                aria-label="Reading status"
                value={book.reading.status}
                onChange={(e) =>
                  onUpdate({
                    ...book,
                    reading: {
                      ...book.reading,
                      status: e.target.value as Book['reading']['status'],
                    },
                  })
                }
              >
                {readingStatuses.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <button className="rating-edit" onClick={onEdit} aria-label="Edit rating">
              <Rating rating={book.reading.rating} />
            </button>
          </div>
          <div className="detail-location">
            <MapPin size={16} />
            <span>
              {book.format === 'Physical'
                ? locationLabel(book.location) || 'Location not recorded'
                : `${book.format} library${book.sourceId ? ` · ${book.sourceId}` : ''}`}
            </span>
            <button className="text-button" onClick={onEdit}>
              {book.format === 'Physical' ? 'Edit location' : 'Edit details'}
            </button>
          </div>
          <div className="book-tags topics">
            {book.topics.map((t) => (
              <span key={t}>{t}</span>
            ))}
            <button onClick={onEdit}>
              <Plus size={12} />
              Add topic
            </button>
          </div>
        </div>
      </section>
      {book.format === 'Physical' && (
        <section className="verification-bar" aria-label="Physical book verification">
          <div>
            <strong>Physical copy: {verificationStatus(book)}</strong>
            <p>
              {book.verification?.checkedAt
                ? `Checked ${book.verification.checkedAt}`
                : 'Check the title, edition and shelf location against your book.'}
            </p>
            {book.verification?.notes && <p className="preserve">{book.verification.notes}</p>}
          </div>
          <div className="verification-actions">
            <button onClick={() => setVerifyOpen(true)}>Verify physical book</button>
            {nextToVerify && <button onClick={() => onOpen(nextToVerify)}>Next to check</button>}
          </div>
        </section>
      )}
      {isbnOpen && <IsbnLookup book={book} onSave={onUpdate} onClose={() => setIsbnOpen(false)} />}
      {coverOpen && (
        <Modal title="Find a book cover" wide onClose={() => setCoverOpen(false)}>
          <CoverSearch
            book={book}
            onSelect={(candidate) => {
              if (
                onUpdate({
                  ...book,
                  coverUrl: candidate.imageUrl,
                  coverSource: {
                    name: 'Open Library',
                    url: candidate.sourceUrl,
                    selectedAt: new Date().toISOString(),
                  },
                })
              )
                setCoverOpen(false)
              else setCoverError('Could not save the cover. Your selection is still here.')
            }}
          />
          {coverError && (
            <p role="alert" className="error">
              {coverError}
            </p>
          )}
        </Modal>
      )}
      {verifyOpen && (
        <VerifyBook
          book={book}
          library={library}
          onSave={onUpdate}
          onClose={() => setVerifyOpen(false)}
          onEdit={() => {
            setVerifyOpen(false)
            onEdit()
          }}
        />
      )}
      {loan && (
        <div className="loan-notice">
          <div>
            <strong>Loaned to {loan.borrower}</strong>
            <p>
              Since {loan.loanedAt}
              {loan.dueAt && ` · Due ${loan.dueAt}`}
            </p>
          </div>
          <button onClick={() => onReturn(loan.id)}>Mark returned</button>
        </div>
      )}
      <div className="detail-tabs" role="tablist" aria-label="Book information">
        {['Overview', 'My Notes', 'Reading History', 'Loans', 'Related Books'].map((t) => (
          <button
            role="tab"
            aria-selected={tab === t}
            key={t}
            className={tab === t ? 'selected' : ''}
            onClick={() => setTab(t)}
          >
            {t}
            {t === 'My Notes'
              ? ` (${book.notes ? 1 : 0})`
              : t === 'Reading History'
                ? ` (${readingRecorded ? 1 : 0})`
                : t === 'Loans'
                  ? ` (${history.length})`
                  : ''}
          </button>
        ))}
      </div>
      <div className="detail-body">
        <section className="detail-content" role="tabpanel" aria-label={tab}>
          {tab === 'Overview' ? (
            <>
              <h3>Summary</h3>
              <p className="preserve">
                {book.summary || 'No summary has been added for this book.'}
              </p>
              <h3>Andrew’s Notes</h3>
              <div className="note-card">
                {book.notes || 'Keep your observations, memorable ideas, and page references here.'}
              </div>
              <button className="small-button" onClick={onEdit}>
                <Plus size={13} />
                {book.notes ? 'Edit note' : 'Add note'}
              </button>
              {book.format === 'Physical' && locationLabel(book.recommendedLocation) && (
                <div className="detail-section">
                  <h3>Recommended physical organization</h3>
                  <p>{locationLabel(book.recommendedLocation)}</p>
                  <small>Future placement; current location is unchanged.</small>
                </div>
              )}
              <details>
                <summary>Catalog source</summary>
                <p>{book.source}</p>
                {book.format === 'Logos' && (
                  <p>
                    {book.license} —{' '}
                    {book.license === 'Temporary'
                      ? 'current access has not been verified'
                      : 'license recorded in the imported catalog'}
                  </p>
                )}
                {book.sourceMetadata && (
                  <dl className="source-metadata">
                    {Object.entries(book.sourceMetadata)
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                  </dl>
                )}
              </details>
            </>
          ) : tab === 'My Notes' ? (
            <>
              <h3>My Notes</h3>
              <div className="note-card">{book.notes || 'No notes yet.'}</div>
              <button onClick={onEdit}>
                <Pencil size={14} />
                Edit notes
              </button>
            </>
          ) : tab === 'Reading History' ? (
            <>
              <h3>Reading record</h3>
              {readingRecorded ? (
                <>
                  <p>
                    <strong>{book.reading.status}</strong>
                    {book.reading.finished && ` · Finished ${book.reading.finished}`}
                  </p>
                  {book.reading.started && <p>Started {book.reading.started}</p>}
                  <p>Source: {book.reading.source || 'Not recorded'}</p>
                  <Rating rating={book.reading.rating} />
                  <p className="muted">
                    This is your current reading record. Earlier readings have not been recorded.
                  </p>
                </>
              ) : (
                <p>No reading has been recorded for this book.</p>
              )}
              <button onClick={onEdit}>Update reading</button>
            </>
          ) : tab === 'Loans' ? (
            <>
              <h3>Loans</h3>
              {history.length ? (
                history.map((l) => (
                  <div className="history-row" key={l.id}>
                    <strong>{l.borrower}</strong>
                    <p>
                      {l.loanedAt} → {l.returnedAt || 'Currently out'}
                    </p>
                    {l.notes && <p>{l.notes}</p>}
                  </div>
                ))
              ) : (
                <p>No loans recorded.</p>
              )}
              {!loan && book.format === 'Physical' && book.ownership === 'Owned' && (
                <button className="primary" onClick={onLoan}>
                  <Plus size={15} />
                  Loan book
                </button>
              )}
            </>
          ) : (
            <>
              <h3>Related Books</h3>
              {related.length ? (
                <BookCards library={library} books={related} view="list" onOpen={onOpen} />
              ) : (
                <p>Add topics or a series to discover related books in your library.</p>
              )}
            </>
          )}
        </section>
        <aside className="use-for">
          <h3>Use For</h3>
          {['Sermon', 'Bible Study', 'Academic', 'Personal', 'Leadership'].map((purpose) => (
            <label key={purpose}>
              <input
                type="checkbox"
                checked={(book.useFor || []).includes(purpose)}
                onChange={(e) =>
                  onUpdate({
                    ...book,
                    useFor: e.target.checked
                      ? [...(book.useFor || []), purpose]
                      : (book.useFor || []).filter((x) => x !== purpose),
                  })
                }
              />
              {purpose}
            </label>
          ))}
          <hr />
          <label>
            <input
              type="checkbox"
              checked={book.wishlist}
              onChange={(e) => onUpdate({ ...book, wishlist: e.target.checked })}
            />
            Wishlist
          </label>
          {!loan && book.format === 'Physical' && book.ownership === 'Owned' && (
            <button onClick={onLoan}>
              <Plus size={14} />
              Loan book
            </button>
          )}
        </aside>
      </div>
    </article>
  )
}
