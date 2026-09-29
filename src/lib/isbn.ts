import { normalizeIsbn } from './covers'
import type { Book } from './model'
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
const text = (v: unknown) => (typeof v === 'string' ? v : '')
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
export interface IsbnWork {
  key: string
  title: string
  author: string
}
export interface IsbnEdition {
  key: string
  title: string
  subtitle: string
  publisher: string
  date: string
  format: string
  edition: string
  languages: string
  isbns: string[]
}
export function isbnWorks(value: unknown): IsbnWork[] {
  const docs = record(value).docs
  if (!Array.isArray(docs)) throw new Error('Unexpected search response. Please try again.')
  return docs.flatMap((v) => {
    const d = record(v)
    return /^\/works\/OL\d+W$/.test(text(d.key)) && text(d.title)
      ? [{ key: text(d.key), title: text(d.title), author: strings(d.author_name).join('; ') }]
      : []
  })
}
export function editionsUrl(key: string, offset: number) {
  if (!/^\/works\/OL\d+W$/.test(key) || !Number.isSafeInteger(offset) || offset < 0)
    throw new Error('Invalid edition lookup.')
  return `https://openlibrary.org${key}/editions.json?limit=20&offset=${offset}`
}
export function isbnEditions(value: unknown) {
  const data = record(value)
  if (!Array.isArray(data.entries))
    throw new Error('Unexpected edition response. Please try again.')
  const editions: IsbnEdition[] = data.entries.flatMap((v) => {
    const d = record(v)
    if (!/^\/books\/OL\d+M$/.test(text(d.key)) || !text(d.title)) return []
    return [
      {
        key: text(d.key),
        title: text(d.title),
        subtitle: text(d.subtitle),
        publisher: strings(d.publishers).join('; '),
        date: text(d.publish_date),
        format: text(d.physical_format),
        edition: text(d.edition_name),
        languages: Array.isArray(d.languages)
          ? d.languages
              .map((x) => text(record(x).key).replace('/languages/', ''))
              .filter(Boolean)
              .join(', ')
          : '',
        isbns: [
          ...new Set(
            [...strings(d.isbn_13), ...strings(d.isbn_10)].map(normalizeIsbn).filter(Boolean),
          ),
        ],
      },
    ]
  })
  return {
    editions,
    total:
      typeof data.size === 'number' && Number.isFinite(data.size) ? data.size : data.entries.length,
  }
}
export function applyEditionIsbn(book: Book, edition: IsbnEdition, isbn: string): Book {
  if (
    !normalizeIsbn(isbn) ||
    !edition.isbns.includes(isbn) ||
    !/^\/books\/OL\d+M$/.test(edition.key)
  )
    throw new Error('Choose a valid ISBN from this edition.')
  return {
    ...book,
    isbn,
    sourceMetadata: {
      ...book.sourceMetadata,
      'ISBN lookup source': `https://openlibrary.org${edition.key}`,
      'ISBN lookup title': edition.title,
      'ISBN lookup edition': edition.edition,
      'ISBN lookup publisher': edition.publisher,
      'ISBN lookup publication date': edition.date,
      'ISBN lookup format': edition.format,
      'ISBN selected': isbn,
      'ISBN selection date': new Date().toISOString(),
    },
  }
}
