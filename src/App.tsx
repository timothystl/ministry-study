import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  BookOpen,
  Bookmark,
  Search,
  List,
  Heart,
  Plus,
  Users,
  Settings,
  X,
  Menu,
  Home,
  MoreHorizontal,
  UserCircle,
  ArrowRight,
  Grid2X2,
  Download,
  SlidersHorizontal,
  Mic,
  ScanBarcode,
  HandHeart,
  Baby,
  Disc3,
  Music,
  ScrollText,
  NotebookPen,
  UserCog,
} from 'lucide-react'
import {
  blankBook,
  verificationStatus,
  nextBookToVerify,
  verificationStatuses,
  formats,
  searchBooks,
  saveBook,
  activeLoan,
  today,
  type Book,
  type Library,
} from './lib/model'
import { downloadJson, loadLibrary, storageKey } from './lib/storage'
import { can, type Me, type SectionKey } from './lib/me'
import { kindsFor } from '../worker/sections'
import { useBundled } from './lib/useBundled'
import { useSync } from './lib/useSync'
import { SyncBanner } from './components/SyncBanner'
import { BookCards, BookDetail } from './components/BookViews'
import { BookEditor } from './components/BookEditor'
import { LibraryData } from './components/LibraryData'
import { WishlistImport } from './components/WishlistImport'
import { LoanForm } from './components/LoanForm'
import { SermonCatalog } from './components/SermonCatalog'
import { ScanBook } from './components/ScanBook'
import { Prayers } from './components/Prayers'
import { Notes } from './components/Notes'
import { People } from './components/People'
import { Hymns } from './components/Hymns'
import { Liturgies } from './components/Liturgies'
import { Resources } from './components/Resources'
import { Dashboard, type QuickScope } from './components/Dashboard'
import { ReadingTable, LoansTable } from './components/RecordsTable'
import { Modal } from './components/Modal'
import './App.css'
type Page =
  | 'Home'
  | 'Search'
  | 'Browse'
  | 'My Collection'
  | 'Reading'
  | 'Loans'
  | 'Wishlist'
  | 'Sermons'
  | 'Prayers'
  | 'Notes'
  | 'Children'
  | 'People'
  | 'Hymns'
  | 'Liturgies'
  | 'Resources'
type Browse = 'Topic' | 'Author' | 'Series' | 'Physical shelf'
// Each page belongs to one part of the study; the pastor switches parts on or off for other people.
const navigation = [
  { name: 'Home', label: 'Search', icon: Search, part: 'library' },
  { name: 'Browse', label: 'Browse', icon: List, part: 'library' },
  { name: 'My Collection', label: 'My Collection', icon: BookOpen, part: 'library' },
  { name: 'Reading', label: 'Reading', icon: Bookmark, part: 'library' },
  { name: 'Loans', label: 'Loans', icon: Users, part: 'library' },
  { name: 'Wishlist', label: 'Wishlist', icon: Heart, part: 'library' },
  { name: 'Sermons', label: 'Sermons', icon: Mic, part: 'sermons' },
  { name: 'Prayers', label: 'Prayers', icon: HandHeart, part: 'prayers' },
  { name: 'Notes', label: 'Devotions & Notes', icon: NotebookPen, part: 'notes' },
  { name: 'Children', label: 'Children’s Messages', icon: Baby, part: 'children' },
  { name: 'Hymns', label: 'Hymns', icon: Music, part: 'hymns' },
  { name: 'Liturgies', label: 'Liturgies', icon: ScrollText, part: 'hymns' },
  { name: 'Resources', label: 'Music Resources', icon: Disc3, part: 'hymns' },
] as const satisfies readonly { name: Page; label: string; icon: unknown; part: SectionKey }[]
export default function App({ me }: { me: Me }) {
  const allowed = (part: SectionKey) => can(me, part)
  const pages = navigation.filter((n) => allowed(n.part))
  const hasLibrary = allowed('library')
  // Which kinds of record are saved to the shared database for this person (null: all of them).
  const kinds = useMemo(() => (me.role === 'admin' ? null : kindsFor(me.sections)), [me])
  const [initial] = useState(loadLibrary),
    [library, setLibrary] = useState(initial.library),
    [error, setError] = useState(initial.error)
  const [liturgyId, setLiturgyId] = useState(''),
    [hymnId, setHymnId] = useState('')
  const [page, setPage] = useState<Page>(pages[0]?.name ?? 'Home'),
    [query, setQuery] = useState(''),
    [menu, setMenu] = useState(false),
    [scope, setScope] = useState<QuickScope>('All')
  const [view, setView] = useState<'grid' | 'list'>('grid'),
    [format, setFormat] = useState('All formats'),
    [ownership, setOwnership] = useState('Any ownership'),
    [showFilters, setShowFilters] = useState(false)
  const [verification, setVerification] = useState('All verification')
  const [reading, setReading] = useState('All reading'),
    [loanHistory, setLoanHistory] = useState(false),
    [browse, setBrowse] = useState<Browse>('Topic'),
    [group, setGroup] = useState(''),
    [groupQuery, setGroupQuery] = useState('')
  const [detailId, setDetailId] = useState(''),
    [editing, setEditing] = useState<Book | null>(null),
    [lending, setLending] = useState<Book | null>(null),
    [scanOpen, setScanOpen] = useState(false),
    [dataOpen, setDataOpen] = useState(false),
    [wishlistImportOpen, setWishlistImportOpen] = useState(false),
    [picker, setPicker] = useState<'loan' | 'read' | null>(null),
    [pickerQuery, setPickerQuery] = useState('')
  const [limit, setLimit] = useState(36),
    [notice, setNotice] = useState('')
  const searchRef = useRef<HTMLInputElement>(null),
    navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (menu) navRef.current?.querySelector('button')?.focus()
  }, [menu])
  const detail = library.books.find((b) => b.id === detailId),
    searching = Boolean(query.trim())
  // The browser keeps a working copy, but it holds only a few megabytes. A large library that
  // is safely in the shared database can go without it.
  const sharedAndSafe = () => sync.status === 'synced' || sync.status === 'saving'
  function commit(next: Library) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(next))
      setLibrary(next)
      setError('')
      setNotice('Saved on this device')
      return true
    } catch {
      if (sharedAndSafe()) {
        localStorage.removeItem(storageKey())
        setLibrary(next)
        setError('')
        setNotice(
          'Saved to the shared library. This library is too large to also keep a copy on this device.',
        )
        return true
      }
      setError(
        'Could not save. Browser storage may be full or unavailable. Export a backup and try again.',
      )
      return false
    }
  }
  const adoptShared = useCallback((next: Library) => {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(next))
    } catch {
      // Too large for the browser's copy; the shared library still has everything.
      localStorage.removeItem(storageKey())
    }
    setLibrary(next)
    setError('')
    return true
  }, [])
  const sync = useSync(library, adoptShared, kinds)
  useBundled(
    library,
    commit,
    allowed('hymns') && (sync.status === 'synced' || sync.status === 'local'),
  )
  function navigate(next: Page) {
    setPage(next)
    setDetailId('')
    setMenu(false)
    setQuery('')
    setScope('All')
    setLimit(36)
    setGroup('')
    setGroupQuery('')
    setFormat('All formats')
    setOwnership('Any ownership')
    setVerification('All verification')
    setNotice('')
    window.scrollTo({ top: 0 })
  }
  function openBook(book: Book) {
    setDetailId(book.id)
    commit({
      ...library,
      recentIds: [book.id, ...(library.recentIds || []).filter((id) => id !== book.id)].slice(
        0,
        20,
      ),
    })
    window.scrollTo({ top: 0 })
  }
  function selectScope(next: QuickScope) {
    navigate('Search')
    setScope(next)
    if (next === 'Not Owned') setReading('Read')
  }
  function updateBook(book: Book) {
    try {
      return commit(
        saveBook(library, book, library.series.find((s) => s.id === book.seriesId)?.name || ''),
      )
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }
  function returnLoan(id: string) {
    commit({
      ...library,
      loans: library.loans.map((l) => (l.id === id ? { ...l, returnedAt: today() } : l)),
    })
  }
  function openPicker(mode: 'loan' | 'read') {
    setPickerQuery('')
    setPicker(mode)
  }
  function searchOwned() {
    navigate('Search')
    setScope('Owned')
    requestAnimationFrame(() => searchRef.current?.focus())
  }
  function groupFor(b: Book): string[] {
    return browse === 'Topic'
      ? b.topics.length
        ? b.topics
        : ['Uncategorized']
      : browse === 'Author'
        ? b.author
          ? b.author
              .split(';')
              .map((x) => x.trim())
              .filter(Boolean)
          : ['Author not recorded']
        : browse === 'Series'
          ? [library.series.find((s) => s.id === b.seriesId)?.name || 'No series']
          : b.format === 'Physical'
            ? [
                [
                  b.location.room,
                  b.location.bookcase && `Bookcase ${b.location.bookcase}`,
                  b.location.shelf && `Shelf ${b.location.shelf}`,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Location not recorded',
              ]
            : []
  }
  const groups = new Map<string, number>()
  library.books.forEach((b) => groupFor(b).forEach((g) => groups.set(g, (groups.get(g) || 0) + 1)))
  const groupList = [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([g]) => g.toLocaleLowerCase().includes(groupQuery.toLocaleLowerCase()))
  let books = searchBooks(library, query).filter(
    (b) =>
      (format === 'All formats' || b.format === format) &&
      (ownership === 'Any ownership' || b.ownership === ownership) &&
      (verification === 'All verification' ||
        (b.format === 'Physical' &&
          (verification === 'To check'
            ? verificationStatus(b) !== 'Confirmed'
            : verificationStatus(b) === verification))),
  )
  books = books.filter((b) =>
    scope === 'All'
      ? true
      : scope === 'Owned'
        ? b.ownership === 'Owned'
        : scope === 'Read'
          ? b.reading.status === 'Read'
          : scope === 'Wishlist'
            ? b.wishlist
            : scope === 'Loaned'
              ? Boolean(activeLoan(library, b.id))
              : b.ownership !== 'Owned',
  )
  if (!searching) {
    if (page === 'My Collection') books = books.filter((b) => b.ownership === 'Owned')
    if (page === 'Wishlist') books = books.filter((b) => b.wishlist)
    if (page === 'Reading')
      books = books.filter((b) =>
        reading === 'All reading'
          ? ['Read', 'Reading', 'Reference', 'Abandoned'].includes(b.reading.status)
          : b.reading.status === reading,
      )
    if (page === 'Browse')
      books = books.filter((b) =>
        group
          ? groupFor(b).includes(group)
          : browse === 'Physical shelf'
            ? b.format === 'Physical'
            : true,
      )
  }
  books.sort((a, b) =>
    page === 'Browse' && group && browse === 'Physical shelf'
      ? a.location.position.localeCompare(b.location.position, undefined, { numeric: true })
      : page === 'Browse' && group && browse === 'Series'
        ? a.volume.localeCompare(b.volume, undefined, { numeric: true }) ||
          a.title.localeCompare(b.title)
        : a.title.localeCompare(b.title),
  )
  const outCount = library.loans.filter((l) => !l.returnedAt).length
  const catalog = (
    <>
      <div className="catalog-toolbar">
        <div className="filters">
          <select
            aria-label="Filter format"
            value={format}
            onChange={(e) => {
              setFormat(e.target.value)
              setLimit(36)
            }}
          >
            {['All formats', ...formats].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            aria-label="Filter ownership"
            value={ownership}
            onChange={(e) => {
              setOwnership(e.target.value)
              setLimit(36)
            }}
          >
            {['Any ownership', 'Owned', 'Not owned', 'Previously owned'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            aria-label="Filter physical verification"
            value={verification}
            onChange={(e) => {
              setVerification(e.target.value)
              setLimit(36)
            }}
          >
            {['All verification', 'To check', ...verificationStatuses].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div className="view-controls">
          <span>{books.length} books</span>
          <button
            aria-label="Cover grid"
            aria-pressed={view === 'grid'}
            className={view === 'grid' ? 'selected' : ''}
            onClick={() => setView('grid')}
          >
            <Grid2X2 size={17} />
          </button>
          <button
            aria-label="Compact list"
            aria-pressed={view === 'list'}
            className={view === 'list' ? 'selected' : ''}
            onClick={() => setView('list')}
          >
            <List size={18} />
          </button>
        </div>
      </div>
      {books.length ? (
        <>
          <BookCards
            books={books.slice(0, limit)}
            library={library}
            view={view}
            onOpen={openBook}
          />
          {books.length > limit && (
            <button className="load-more" onClick={() => setLimit(limit + 36)}>
              Show more · {books.length - limit} remaining
            </button>
          )}
        </>
      ) : (
        <div className="empty">
          <BookOpen size={32} />
          <h3>{searching ? 'No books match this search.' : 'No books here yet.'}</h3>
          <p>
            {searching
              ? 'Try fewer words or change the filters.'
              : 'Add a book or update a book’s details to get started.'}
          </p>
          <button
            onClick={() =>
              searching
                ? (setQuery(''),
                  setScope('All'),
                  setFormat('All formats'),
                  setOwnership('Any ownership'),
                  setVerification('All verification'))
                : setEditing(blankBook())
            }
          >
            {searching ? 'Clear search and filters' : 'Add a book'}
          </button>
        </div>
      )}
    </>
  )
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation backdrop"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        ref={navRef}
        className={`sidebar ${menu ? 'open' : ''}`}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setMenu(false)
        }}
      >
        <div className="brand">
          <BookOpen size={28} />
          <span>My Library</span>
          <button
            className="mobile-close icon-button"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          >
            <X size={20} />
          </button>
        </div>
        <nav aria-label="Main navigation">
          {pages.map(({ name, label, icon: Icon }) => (
            <button
              key={name}
              aria-current={
                page === name || (name === 'Home' && page === 'Search') ? 'page' : undefined
              }
              className={page === name || (name === 'Home' && page === 'Search') ? 'active' : ''}
              onClick={() => navigate(name)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {name === 'Loans' && outCount > 0 && <b>{outCount}</b>}
            </button>
          ))}
          {me.role === 'admin' && !me.local && (
            <button
              aria-current={page === 'People' ? 'page' : undefined}
              className={page === 'People' ? 'active' : ''}
              onClick={() => navigate('People')}
            >
              <UserCog size={19} />
              <span>People</span>
            </button>
          )}
          {hasLibrary && (
            <>
              <button
                onClick={() => {
                  setScanOpen(true)
                  setMenu(false)
                }}
              >
                <ScanBarcode size={19} />
                <span>Scan a Book</span>
              </button>
              <button
                onClick={() => {
                  setEditing(blankBook())
                  setMenu(false)
                }}
              >
                <Plus size={19} />
                <span>Add Book</span>
              </button>
            </>
          )}
          <button
            onClick={() => {
              setDataOpen(true)
              setMenu(false)
            }}
          >
            <Settings size={19} />
            <span>Library Data</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <UserCircle size={34} />
          <div>
            <strong>{me.name}</strong>
            <span>
              {hasLibrary
                ? `${library.books.length.toLocaleString()} books${library.sample ? ' · Sample' : ''}`
                : me.role === 'admin'
                  ? 'Administrator'
                  : 'Signed in'}
            </span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="mobile-header">
          <button
            className="icon-button"
            aria-label="Open navigation"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Menu size={20} />
          </button>
          <span>
            <BookOpen size={20} />
            My Library
          </span>
          <UserCircle size={26} />
        </header>
        <main
          id="main"
          className={detail ? 'detail-main' : page === 'Home' && !searching ? 'home-main' : ''}
        >
          <SyncBanner
            status={sync.status}
            remoteCount={sync.remoteCount}
            onUseDevice={() => void sync.keepThisDevice()}
            onUseShared={sync.takeShared}
          />
          {error && (
            <div className="error" role="alert">
              <p>{error}</p>
              <button
                onClick={() =>
                  downloadJson(
                    localStorage.getItem(storageKey()) || library,
                    'ministry-study-recovery.backup.json',
                  )
                }
              >
                <Download size={15} />
                Export stored data
              </button>
            </div>
          )}
          {page === 'People' && me.role === 'admin' ? (
            <People />
          ) : !pages.length ? (
            <section className="sermons">
              <h1>Nothing turned on yet</h1>
              <p className="muted">
                Andrew hasn’t turned on any part of the study for you yet. Please check with him.
              </p>
            </section>
          ) : page === 'Sermons' ? (
            <SermonCatalog library={library} onSave={commit} />
          ) : page === 'Prayers' ? (
            <Prayers library={library} onSave={commit} />
          ) : page === 'Notes' ? (
            <Notes library={library} onSave={commit} />
          ) : page === 'Hymns' ? (
            <Hymns
              library={library}
              onSave={commit}
              openId={hymnId}
              setOpenId={setHymnId}
              onOpenLiturgy={(id) => {
                setLiturgyId(id)
                setPage('Liturgies')
              }}
            />
          ) : page === 'Liturgies' ? (
            <Liturgies
              library={library}
              onSave={commit}
              openId={liturgyId}
              setOpenId={setLiturgyId}
              onOpenHymn={(id) => {
                setHymnId(id)
                setPage('Hymns')
              }}
            />
          ) : page === 'Resources' ? (
            <Resources library={library} onSave={commit} />
          ) : page === 'Children' ? (
            <Notes library={library} onSave={commit} kidsPage />
          ) : detail ? (
            <BookDetail
              key={detail.id}
              book={detail}
              library={library}
              onClose={() => setDetailId('')}
              onEdit={() => setEditing(detail)}
              onLoan={() => setLending(detail)}
              onReturn={returnLoan}
              onUpdate={updateBook}
              nextToVerify={nextBookToVerify(library, detail.id)}
              onOpen={openBook}
            />
          ) : (
            <>
              <div
                className={`search-row ${page === 'Loans' || page === 'Reading' ? 'secondary-search' : ''}`}
              >
                <div className="search-bar">
                  <Search size={20} />
                  <input
                    ref={searchRef}
                    aria-label="Search entire library"
                    placeholder="Search by title, author, topic, series, or your notes..."
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      setLimit(36)
                    }}
                  />
                  {query ? (
                    <button
                      className="icon-button"
                      aria-label="Clear search"
                      onClick={() => setQuery('')}
                    >
                      <X size={16} />
                    </button>
                  ) : (
                    <button
                      className="icon-button"
                      aria-label="Show search filters"
                      aria-expanded={showFilters}
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <SlidersHorizontal size={17} />
                    </button>
                  )}
                </div>
                <div className="scope-filters" aria-label="Library quick filters">
                  {(
                    ['All', 'Owned', 'Read', 'Wishlist', 'Loaned', 'Not Owned'] as QuickScope[]
                  ).map((x) => (
                    <button
                      key={x}
                      aria-pressed={scope === x}
                      className={scope === x ? 'selected' : ''}
                      onClick={() => selectScope(x)}
                    >
                      {x}
                    </button>
                  ))}
                </div>
              </div>
              {showFilters && (
                <div className="expanded-filters">
                  <label>
                    Format
                    <select
                      value={format}
                      onChange={(e) => {
                        setFormat(e.target.value)
                        if (page === 'Home') setPage('Search')
                      }}
                    >
                      {['All formats', ...formats].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <p>
                    Search covers catalog information and personal notes, not the contents of books.
                  </p>
                </div>
              )}
              {page === 'Home' && !searching ? (
                <Dashboard
                  library={library}
                  onOpen={openBook}
                  onScope={selectScope}
                  onAdd={() => setEditing(blankBook())}
                  onImport={() => setDataOpen(true)}
                  onReading={() => openPicker('read')}
                  onLoans={() => openPicker('loan')}
                  onBrowse={() => navigate('Browse')}
                  onSearch={searchOwned}
                  onReadNotOwned={() => {
                    navigate('Reading')
                    setReading('Read')
                    setScope('Not Owned')
                  }}
                />
              ) : (
                <>
                  <div className="page-heading">
                    <h1>
                      {searching ? 'Search Results' : page === 'Search' ? 'Your Library' : page}
                    </h1>
                    {page === 'Wishlist' && !searching ? (
                      <div className="wishlist-actions">
                        <button onClick={() => setWishlistImportOpen(true)}>Import wishlist</button>
                        <button
                          className="primary"
                          onClick={() =>
                            setEditing({ ...blankBook(), ownership: 'Not owned', wishlist: true })
                          }
                        >
                          <Plus size={15} /> Add Book
                        </button>
                      </div>
                    ) : page === 'Loans' && !searching ? (
                      <button className="primary" onClick={() => openPicker('loan')}>
                        <Plus size={15} />
                        Loan a Book
                      </button>
                    ) : page === 'Reading' && !searching ? (
                      <button className="primary" onClick={() => openPicker('read')}>
                        <Plus size={15} />
                        Mark as Read
                      </button>
                    ) : (
                      <button className="primary" onClick={() => setEditing(blankBook())}>
                        <Plus size={15} />
                        Add Book
                      </button>
                    )}
                  </div>
                  {searching && (
                    <p className="results-note">
                      Searching across your library, including books you don’t own.{' '}
                      {scope !== 'All' && `Filter: ${scope}.`}
                    </p>
                  )}
                  {page === 'Loans' && !searching ? (
                    <>
                      <div className="tabs">
                        <button
                          className={!loanHistory ? 'selected' : ''}
                          onClick={() => setLoanHistory(false)}
                        >
                          Currently Out ({outCount})
                        </button>
                        <button
                          className={loanHistory ? 'selected' : ''}
                          onClick={() => setLoanHistory(true)}
                        >
                          Loan History ({library.loans.length - outCount})
                        </button>
                      </div>
                      <LoansTable
                        library={library}
                        history={loanHistory}
                        onOpen={openBook}
                        onReturn={returnLoan}
                        onAdd={() => openPicker('loan')}
                      />
                    </>
                  ) : page === 'Reading' && !searching ? (
                    <>
                      <div className="tabs">
                        {['All reading', 'Reading', 'Read', 'Unread', 'Reference', 'Abandoned'].map(
                          (x) => (
                            <button
                              key={x}
                              className={reading === x ? 'selected' : ''}
                              onClick={() => {
                                setReading(x)
                                setLimit(36)
                              }}
                            >
                              {x === 'Reading'
                                ? 'Currently Reading'
                                : x === 'Unread'
                                  ? 'Unread'
                                  : x === 'Abandoned'
                                    ? 'Did Not Finish'
                                    : x}{' '}
                              (
                              {
                                library.books.filter((b) =>
                                  x === 'All reading'
                                    ? ['Read', 'Reading', 'Reference', 'Abandoned'].includes(
                                        b.reading.status,
                                      )
                                    : b.reading.status === x,
                                ).length
                              }
                              )
                            </button>
                          ),
                        )}
                      </div>
                      <ReadingTable books={books.slice(0, limit)} onOpen={openBook} />
                      {!books.length && (
                        <p className="table-empty">
                          No reading recorded here yet. Add a book you’ve read, even if you don’t
                          own it.
                        </p>
                      )}
                      {books.length > limit && (
                        <button className="load-more" onClick={() => setLimit(limit + 36)}>
                          Show more
                        </button>
                      )}
                    </>
                  ) : page === 'Browse' && !searching ? (
                    <>
                      <div className="tabs">
                        {(['Topic', 'Author', 'Series', 'Physical shelf'] as Browse[]).map((x) => (
                          <button
                            key={x}
                            className={browse === x ? 'selected' : ''}
                            onClick={() => {
                              setBrowse(x)
                              setGroup('')
                              setGroupQuery('')
                              setLimit(36)
                            }}
                          >
                            {x}
                          </button>
                        ))}
                      </div>
                      <div className="browse-layout">
                        <aside className="group-panel">
                          <label>
                            Find a {browse.toLowerCase()}
                            <input
                              value={groupQuery}
                              onChange={(e) => setGroupQuery(e.target.value)}
                              placeholder="Filter groups..."
                            />
                          </label>
                          <div className="group-list">
                            <button
                              className={!group ? 'selected' : ''}
                              onClick={() => setGroup('')}
                            >
                              All books <ArrowRight size={14} />
                            </button>
                            {groupList.map(([g, n]) => (
                              <button
                                key={g}
                                className={group === g ? 'selected' : ''}
                                onClick={() => {
                                  setGroup(g)
                                  setLimit(36)
                                }}
                              >
                                <span>{g}</span>
                                <small>{n}</small>
                              </button>
                            ))}
                          </div>
                        </aside>
                        <section className="browse-results">
                          <h2>{group || `Browse by ${browse.toLowerCase()}`}</h2>
                          {catalog}
                        </section>
                      </div>
                    </>
                  ) : (
                    catalog
                  )}
                </>
              )}
              <footer className="page-footer">
                <span>
                  {library.sample
                    ? 'Illustrative sample books · Not your holdings'
                    : 'Saved on this device · Ministry Study v0.1'}
                </span>
                <button onClick={() => setDataOpen(true)}>
                  {library.sample ? 'Import your catalog' : 'Backup & import'}
                </button>
              </footer>
            </>
          )}
          <div className="sr-only" role="status">
            {notice}
            {searching && ` ${books.length} search results`}
          </div>
        </main>
      </div>
      <nav className="mobile-bottom" aria-label="Mobile navigation">
        {(hasLibrary
          ? [
              { label: 'Home', icon: Home, target: 'Home' },
              { label: 'Search', icon: Search, target: 'Search' },
              { label: 'Browse', icon: List, target: 'Browse' },
              { label: 'Reading', icon: BookOpen, target: 'Reading' },
            ]
          : []
        ).map(({ label, icon: Icon, target }) => (
          <button
            key={label}
            className={page === target && !detail ? 'active' : ''}
            onClick={() => navigate(target as Page)}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
        <button onClick={() => setMenu(!menu)} aria-label="More navigation">
          <MoreHorizontal size={22} />
          More
        </button>
      </nav>
      {scanOpen && (
        <ScanBook
          library={library}
          onSave={commit}
          onOpen={(book) => {
            setScanOpen(false)
            openBook(book)
          }}
          onClose={() => setScanOpen(false)}
        />
      )}
      {editing && (
        <BookEditor
          book={editing}
          library={library}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            if (commit(next)) {
              setDetailId(editing.id)
              setEditing(null)
              return true
            }
            return false
          }}
        />
      )}
      {lending && (
        <LoanForm
          book={lending}
          library={library}
          onClose={() => setLending(null)}
          onSave={(next) => {
            if (commit(next)) {
              setDetailId(lending.id)
              setLending(null)
              return true
            }
            return false
          }}
        />
      )}
      {wishlistImportOpen && (
        <WishlistImport
          library={library}
          onClose={() => setWishlistImportOpen(false)}
          onSave={(next) => {
            if (!commit(next)) return false
            setWishlistImportOpen(false)
            navigate('Wishlist')
            setNotice('Wishlist imported')
            return true
          }}
        />
      )}
      {dataOpen && (
        <LibraryData
          library={library}
          onClose={() => setDataOpen(false)}
          onSave={(next) => {
            if (commit(next)) {
              setDataOpen(false)
              setDetailId('')
              setLimit(36)
              return true
            }
            return false
          }}
        />
      )}
      {picker && (
        <Modal
          title={picker === 'loan' ? 'Choose a book to lend' : 'Record your reading'}
          onClose={() => setPicker(null)}
        >
          <label>
            Find a book
            <input
              autoFocus
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="Title or author..."
            />
          </label>
          <div className="picker-list">
            {searchBooks(library, pickerQuery)
              .filter(
                (b) =>
                  picker === 'read' ||
                  (b.ownership === 'Owned' &&
                    b.format === 'Physical' &&
                    !activeLoan(library, b.id)),
              )
              .slice(0, 30)
              .map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    if (picker === 'loan') setLending(b)
                    else
                      setEditing({
                        ...b,
                        reading: {
                          ...b.reading,
                          status: 'Read',
                          finished: b.reading.finished || today(),
                        },
                      })
                    setPicker(null)
                  }}
                >
                  <strong>{b.title}</strong>
                  <span>{b.author}</span>
                </button>
              ))}
          </div>
          <button
            className="primary"
            onClick={() => {
              const b = blankBook()
              if (picker === 'read') {
                b.ownership = 'Not owned'
                b.reading.status = 'Read'
                b.reading.finished = today()
              }
              setEditing(b)
              setPicker(null)
            }}
          >
            <Plus size={16} />
            {picker === 'read' ? 'Add a book I’ve read' : 'Add an owned physical book'}
          </button>
        </Modal>
      )}
    </div>
  )
}
