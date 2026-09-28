import {
  ArrowRight,
  BookOpen,
  Bookmark,
  CheckCircle2,
  Search,
  Plus,
  Upload,
  Users,
  LibraryBig,
  List,
} from 'lucide-react'
import { type Book, type Library, locationLabel } from '../lib/model'
import { Cover } from './BookViews'
export type QuickScope = 'All' | 'Owned' | 'Read' | 'Wishlist' | 'Loaned' | 'Not Owned'
export function Dashboard({
  library,
  onOpen,
  onScope,
  onAdd,
  onImport,
  onReading,
  onLoans,
  onBrowse,
  onSearch,
  onReadNotOwned,
}: {
  library: Library
  onOpen: (b: Book) => void
  onScope: (scope: QuickScope) => void
  onAdd: () => void
  onImport: () => void
  onReading: () => void
  onLoans: () => void
  onBrowse: () => void
  onSearch: () => void
  onReadNotOwned: () => void
}) {
  const recentIds = library.recentIds || []
  const viewed = recentIds
    .map((id) => library.books.find((b) => b.id === id))
    .filter((b): b is Book => Boolean(b))
  const recent = (viewed.length ? viewed : library.books).slice(0, 6)
  const stats = [
    { label: 'Total Books', value: library.books.length, icon: BookOpen, scope: 'All' },
    {
      label: 'Owned',
      value: library.books.filter((b) => b.ownership === 'Owned').length,
      icon: CheckCircle2,
      scope: 'Owned',
    },
    {
      label: 'Read',
      value: library.books.filter((b) => b.reading.status === 'Read').length,
      icon: BookOpen,
      scope: 'Read',
    },
    {
      label: 'Wishlist',
      value: library.books.filter((b) => b.wishlist).length,
      icon: Bookmark,
      scope: 'Wishlist',
    },
    {
      label: 'Loaned Out',
      value: library.loans.filter((l) => !l.returnedAt).length,
      icon: Users,
      scope: 'Loaned',
    },
    {
      label: 'Not Owned (but read)',
      value: library.books.filter((b) => b.ownership !== 'Owned' && b.reading.status === 'Read')
        .length,
      icon: LibraryBig,
      scope: 'Not Owned',
    },
  ] as const
  const actions = [
    {
      title: 'Do I own this?',
      description: 'Check before you buy',
      icon: Search,
      action: onSearch,
    },
    { title: 'Add Book', description: 'A place for your next book', icon: Plus, action: onAdd },
    {
      title: 'Import Catalog',
      description: 'Bring your library together',
      icon: Upload,
      action: onImport,
    },
    { title: 'Log a Loan', description: 'Track books you lend', icon: Users, action: onLoans },
    {
      title: 'Mark as Read',
      description: 'Even if you don’t own it',
      icon: BookOpen,
      action: onReading,
    },
  ]
  return (
    <>
      <section className="library-hero" aria-label="Good Books for a Greater Story">
        <div>
          <h1>
            Good Books
            <br />
            for a Greater Story
          </h1>
          <p>Read. Study. Preach. Serve.</p>
        </div>
        <blockquote>
          “The more that you read,
          <br />
          the more things you will know.
          <br />
          The more that you learn,
          <br />
          the more places you’ll go.”<cite>— Dr. Seuss</cite>
        </blockquote>
      </section>
      <div className="stats">
        {stats.map(({ label, value, icon: Icon, scope }, i) => (
          <button
            key={label}
            className={`stat stat-${i}`}
            onClick={() => (scope === 'Not Owned' ? onReadNotOwned() : onScope(scope))}
          >
            <Icon size={28} />
            <div>
              <strong>{value.toLocaleString()}</strong>
              <span>{label}</span>
            </div>
          </button>
        ))}
      </div>
      <section className="mobile-quick">
        <button onClick={onSearch}>
          <Search />
          <span>Do I own this?</span>
        </button>
        <button onClick={onBrowse}>
          <List />
          <span>Browse</span>
        </button>
        <button onClick={onAdd}>
          <Plus />
          <span>Add Book</span>
        </button>
        <button onClick={onImport}>
          <Upload />
          <span>Import Catalog</span>
        </button>
        <button onClick={onReading}>
          <BookOpen />
          <span>Reading</span>
        </button>
        <button onClick={onLoans}>
          <Users />
          <span>Loans</span>
        </button>
      </section>
      <section className="recent-section">
        <div className="section-title">
          <h2>{viewed.length ? 'Recently Viewed' : 'From Your Library'}</h2>
          <button className="text-button" onClick={() => onScope('All')}>
            See all <ArrowRight size={15} />
          </button>
        </div>
        <div className="recent-books">
          {recent.map((b) => (
            <button className="recent-book" key={b.id} onClick={() => onOpen(b)}>
              <Cover book={b} />
              <div className="recent-info">
                <h3>{b.title}</h3>
                <p>{b.author || 'Author not recorded'}</p>
                <span className="mobile-location">
                  {b.format === 'Physical' ? locationLabel(b.location) : b.format}
                </span>
              </div>
              {b.reading.status === 'Read' && <span className="mobile-read">✓ Read</span>}
            </button>
          ))}
          <button className="add-book-tile" onClick={onAdd}>
            <Plus size={28} />
            <span>Add Book</span>
          </button>
        </div>
        {!library.books.length && (
          <p className="empty-copy">Add your first book or import your catalog to begin.</p>
        )}
      </section>
      <section className="quick-actions">
        <h2>Quick Actions</h2>
        <div>
          {actions.map(({ title, description, icon: Icon, action }) => (
            <button key={title} onClick={action}>
              <Icon size={26} />
              <div>
                <strong>{title}</strong>
                <span>{description}</span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </>
  )
}
