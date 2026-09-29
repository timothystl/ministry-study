import { normalizeIsbn } from './covers'
import { blankBook, type Book, type Library } from './model'
import { googleBooksVolume, openLibrarySummary, type PublishedSummary } from './summary'

// Turns a scanned or typed ISBN into a book description from Open Library (and Google Books for
// what Open Library lacks), and matches it against the library.
export interface ScanResult {
  isbn: string // ISBN-13
  title: string
  subtitle: string
  authors: string
  publisher: string
  year: string
  coverUrl: string
  coverSource: { name: string; url: string }
  sourceUrl: string
  summary: PublishedSummary | null
}
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
const text = (v: unknown) => (typeof v === 'string' ? v : '')
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

export function toIsbn13(input: string): string {
  const isbn = normalizeIsbn(input)
  if (isbn.length !== 10) return isbn
  const body = '978' + isbn.slice(0, 9)
  const sum = [...body].reduce((total, c, i) => total + Number(c) * (i % 2 ? 3 : 1), 0)
  return body + ((10 - (sum % 10)) % 10)
}
// The numbers in a barcode, read from a camera or typed. Book barcodes are EAN-13 and start 978
// or 979; anything else is not a book.
export function isbnFromCode(code: string): string {
  const digits = code.replace(/[\s-]/g, '')
  if (/^97[89]\d{10}$/.test(digits) || /^\d{9}[\dX]$/i.test(digits)) return toIsbn13(digits)
  return ''
}
export type FetchJson = (url: string) => Promise<unknown | null>
export const fetchJson: FetchJson = async (url) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
    return response.ok ? await response.json() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
const cover = (id: unknown) =>
  Number.isSafeInteger(id) && Number(id) > 0
    ? `https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false`
    : ''
export async function lookupIsbn(
  input: string,
  get: FetchJson = fetchJson,
): Promise<ScanResult | null> {
  const isbn = toIsbn13(input)
  if (!isbn) return null
  const [edition, search, google] = await Promise.all([
    get(`https://openlibrary.org/isbn/${isbn}.json`),
    get(
      `https://openlibrary.org/search.json?${new URLSearchParams({ isbn, fields: 'key,title,author_name,cover_i,first_publish_year', limit: '1' })}`,
    ),
    get(
      `https://www.googleapis.com/books/v1/volumes?${new URLSearchParams({ q: `isbn:${isbn}`, maxResults: '1' })}`,
    ),
  ])
  const e = record(edition)
  const doc = record(
    Array.isArray(record(search).docs) ? (record(search).docs as unknown[])[0] : {},
  )
  const g = googleBooksVolume(google)
  const title = text(e.title) || text(doc.title) || g?.title || ''
  if (!title) return null
  const workKey = text(record(Array.isArray(e.works) ? e.works[0] : {}).key) || text(doc.key)
  const workUrl = /^\/works\/OL\d+W$/.test(workKey) ? `https://openlibrary.org${workKey}` : ''
  let summary = openLibrarySummary(e, `https://openlibrary.org/isbn/${isbn}`)
  if (!summary && workUrl) summary = openLibrarySummary(await get(`${workUrl}.json`), workUrl)
  summary ||= g?.summary ?? null
  const olCover =
    cover(Array.isArray(e.covers) ? e.covers.find((c) => cover(c)) : undefined) ||
    cover(doc.cover_i)
  const year =
    /\d{4}/.exec(text(e.publish_date))?.[0] || g?.year || String(doc.first_publish_year || '')
  return {
    isbn,
    title,
    subtitle: text(e.subtitle) || g?.subtitle || '',
    authors: strings(doc.author_name).join('; ') || g?.authors || '',
    publisher: strings(e.publishers).join('; ') || g?.publisher || '',
    year,
    coverUrl: olCover || g?.coverUrl || '',
    coverSource: olCover
      ? { name: 'Open Library', url: `https://openlibrary.org/isbn/${isbn}` }
      : {
          name: 'Google Books',
          url: g?.summary?.url || `https://books.google.com/books?vid=ISBN${isbn}`,
        },
    sourceUrl: `https://openlibrary.org/isbn/${isbn}`,
    summary,
  }
}

// ----- Matching -----
const words = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
const titleKey = (title: string) => {
  const main = words(title.split(/[:—–]/)[0])
  return (/^(the|a|an)$/.test(main[0] || '') ? main.slice(1) : main).join(' ')
}
const surname = (author: string) => words(author.split(/[;,]/)[0]).at(-1) || ''
export interface BookMatches {
  sameIsbn: Book[]
  similar: Book[]
}
export function matchBooks(library: Library, result: ScanResult): BookMatches {
  const key = titleKey(result.title)
  const last = surname(result.authors)
  // The illustrative sample books are not the user's books.
  const books = library.books.filter((b) => !b.id.startsWith('sample-'))
  const sameIsbn = books.filter((b) => toIsbn13(b.isbn) === result.isbn)
  const similar = books.filter((b) => {
    if (sameIsbn.includes(b)) return false
    const other = titleKey(b.title)
    const close =
      other === key ||
      (Math.min(other.length, key.length) >= 8 && (other.includes(key) || key.includes(other)))
    if (!close) return false
    const theirs = surname(b.author)
    return !last || !theirs || words(b.author).includes(last) || theirs === last
  })
  return { sameIsbn, similar: similar.slice(0, 6) }
}
const sourceNote = (book: Book, result: ScanResult) => ({
  ...book.sourceMetadata,
  'ISBN lookup source': result.sourceUrl,
  'ISBN selected': result.isbn,
  'ISBN selection date': new Date().toISOString(),
  'ISBN lookup method': 'Barcode scan or typed ISBN',
})
// A scanned barcode identifies the edition, so its author, publisher, year and subtitle replace
// what was recorded (a blank in the scan leaves the recorded value alone). Title, notes, location
// and reading records are never touched. The cover and summary are added only when asked.
export function applyScan(
  book: Book,
  result: ScanResult,
  options: { cover: boolean; summary: boolean },
): Book {
  const coverPart =
    options.cover && result.coverUrl
      ? {
          coverUrl: result.coverUrl,
          coverSource: {
            name: result.coverSource.name,
            url: result.coverSource.url,
            selectedAt: new Date().toISOString(),
          },
        }
      : {}
  return {
    ...book,
    ...coverPart,
    isbn: result.isbn,
    author: result.authors || book.author,
    publisher: result.publisher || book.publisher,
    year: result.year || book.year,
    subtitle: result.subtitle || book.subtitle || undefined,
    summary: options.summary && result.summary ? result.summary.text : book.summary,
    sourceMetadata: {
      ...sourceNote(book, result),
      ...(options.summary && result.summary
        ? { 'Summary source': `${result.summary.source} ${result.summary.url}`.trim() }
        : {}),
    },
  }
}
export function newBookFromScan(result: ScanResult, summary: boolean): Book {
  return applyScan(
    {
      ...blankBook(),
      title: result.title,
      source: 'Barcode scan',
      sourceId: result.isbn,
    },
    result,
    { cover: true, summary },
  )
}
