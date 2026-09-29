import type { Note } from './notes'
import type { Prayer, PrayerSet } from './prayers'
import type { Sermon } from './sermons'
export const ownerships = ['Owned', 'Not owned', 'Previously owned'] as const
export const readingStatuses = [
  'Not recorded',
  'Unread',
  'Reading',
  'Read',
  'Abandoned',
  'Reference',
] as const
export const formats = ['Physical', 'Logos', 'EPUB', 'PDF', 'Kindle'] as const
export interface Series {
  id: string
  name: string
}
export interface Location {
  room: string
  bookcase: string
  shelf: string
  position: string
}
export const verificationStatuses = ['Not checked', 'Needs correction', 'Confirmed'] as const
export function verificationStatus(book: Book) {
  return book.verification?.status || 'Not checked'
}
export function nextBookToVerify(library: Library, currentId: string) {
  const physical = library.books
    .filter((b) => b.format === 'Physical')
    .sort(
      (a, b) =>
        [a.location.room, a.location.bookcase, a.location.shelf, a.location.position]
          .join('|')
          .localeCompare(
            [b.location.room, b.location.bookcase, b.location.shelf, b.location.position].join('|'),
            undefined,
            { numeric: true },
          ) || a.id.localeCompare(b.id),
    )
  const index = physical.findIndex((b) => b.id === currentId)
  return [...physical.slice(index + 1), ...physical.slice(0, index)].find(
    (b) => b.id !== currentId && verificationStatus(b) !== 'Confirmed',
  )
}
export interface Book {
  coverSource?: { name: string; url: string; selectedAt: string }
  verification?: { status: (typeof verificationStatuses)[number]; checkedAt: string; notes: string }

  edition?: string
  subtitle?: string
  coverUrl?: string
  useFor?: string[]

  id: string
  title: string
  author: string
  publisher: string
  year: string
  isbn: string
  format: (typeof formats)[number]
  ownership: (typeof ownerships)[number]
  wishlist: boolean
  license: 'Permanent' | 'Temporary' | 'Unknown'
  topics: string[]
  seriesId: string
  volume: string
  notes: string
  summary: string
  reading: {
    status: (typeof readingStatuses)[number]
    started: string
    finished: string
    rating: number
    source: string
  }
  location: Location
  recommendedLocation: Location
  source: string
  sourceId: string
  sourceMetadata?: Record<string, string>
  updatedAt: string
}
export interface Loan {
  id: string
  bookId: string
  borrower: string
  loanedAt: string
  dueAt: string
  returnedAt: string
  notes: string
}
export interface Library {
  recentIds?: string[]

  version: 1
  books: Book[]
  series: Series[]
  loans: Loan[]
  sermons: Sermon[]
  prayers: Prayer[]
  prayerSets: PrayerSet[]
  notes: Note[]
  sample: boolean
}
export const blankLocation = (): Location => ({ room: '', bookcase: '', shelf: '', position: '' })
export const today = () => new Date().toLocaleDateString('en-CA')
export const blankBook = (): Book => ({
  id: crypto.randomUUID(),
  title: '',
  author: '',
  publisher: '',
  year: '',
  isbn: '',
  format: 'Physical',
  ownership: 'Owned',
  wishlist: false,
  license: 'Unknown',
  topics: [],
  seriesId: '',
  volume: '',
  notes: '',
  summary: '',
  reading: { status: 'Not recorded', started: '', finished: '', rating: 0, source: '' },
  location: blankLocation(),
  recommendedLocation: blankLocation(),
  source: 'Manually added',
  sourceId: '',
  updatedAt: new Date().toISOString(),
})
export const locationLabel = (l: Location) =>
  [
    l.room,
    l.bookcase && `Bookcase ${l.bookcase}`,
    l.shelf && `Shelf ${l.shelf}`,
    l.position && `#${l.position}`,
  ]
    .filter(Boolean)
    .join(' · ')
export const activeLoan = (library: Library, id: string) =>
  library.loans.find((l) => l.bookId === id && !l.returnedAt)
export function searchBooks(library: Library, query: string) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
  return library.books.filter((b) => {
    const series = library.series.find((s) => s.id === b.seriesId)?.name || ''
    const text = [
      b.title,
      b.author,
      b.publisher,
      b.isbn,
      b.summary,
      b.notes,
      ...b.topics,
      series,
      b.volume,
      locationLabel(b.location),
    ]
      .join(' ')
      .toLocaleLowerCase()
    return terms.every((t) => text.includes(t))
  })
}
export function lendBook(library: Library, loan: Loan): Library {
  const book = library.books.find((b) => b.id === loan.bookId)
  if (!book || book.ownership !== 'Owned' || book.format !== 'Physical')
    throw new Error('Only an owned physical book can be loaned out.')
  if (activeLoan(library, book.id)) throw new Error('This book is already loaned out.')
  if (!loan.borrower.trim() || !loan.loanedAt || (loan.dueAt && loan.dueAt < loan.loanedAt))
    throw new Error('Check the borrower and loan dates.')
  return { ...library, loans: [...library.loans, loan] }
}
// A cover is a bundled image, an https address, or a small photo taken with the camera.
export const validCoverUrl = (url: string) =>
  url.startsWith('/assets/') ||
  /^https:\/\//.test(url) ||
  (/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(url) && url.length <= 150_000)
export function saveBook(library: Library, book: Book, seriesName: string): Library {
  if (!book.title.trim()) throw new Error('Please enter a title.')
  if (book.coverUrl && !validCoverUrl(book.coverUrl))
    throw new Error('Please use an HTTPS cover image URL.')
  if (book.reading.started && book.reading.finished && book.reading.finished < book.reading.started)
    throw new Error('The finished date must follow the started date.')
  if (activeLoan(library, book.id) && (book.format !== 'Physical' || book.ownership !== 'Owned'))
    throw new Error('Return the active loan before changing ownership or format.')
  const series = [...library.series]
  const name = seriesName.trim()
  let existing = series.find((s) => s.name.toLocaleLowerCase() === name.toLocaleLowerCase())
  if (name && !existing) {
    existing = { id: crypto.randomUUID(), name }
    series.push(existing)
  }
  const saved = {
    ...book,
    title: book.title.trim(),
    seriesId: name ? existing!.id : '',
    updatedAt: new Date().toISOString(),
  }
  const previous = library.books.find((b) => b.id === book.id)
  const identity = (b: Book) =>
    JSON.stringify([
      b.title,
      b.subtitle || '',
      b.edition ?? b.sourceMetadata?.Edition ?? '',
      b.author,
      b.isbn,
      b.publisher,
      b.year,
      b.format,
      b.seriesId,
      b.volume,
      b.location.room,
      b.location.bookcase,
      b.location.shelf,
      b.location.position,
    ])
  if (
    saved.verification?.status === 'Confirmed' &&
    previous &&
    identity(previous) !== identity(saved)
  ) {
    saved.verification = { ...saved.verification, status: 'Not checked', checkedAt: '' }
  }
  return {
    ...library,
    series,
    books: library.books.some((b) => b.id === book.id)
      ? library.books.map((b) => (b.id === book.id ? saved : b))
      : [...library.books, saved],
  }
}
