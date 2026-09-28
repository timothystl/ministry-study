import { blankBook, saveBook, type Library, type Book } from './model'

export interface WishlistRow {
  title: string
  author: string
  isbn?: string
  series?: string
  notes?: string
}
export interface WishlistPreview {
  library: Library
  entries: {
    title: string
    action: 'Add book' | 'Add to wishlist' | 'Already listed' | 'Needs review'
  }[]
  added: number
  updated: number
}
const normalize = (value: string) =>
  value.trim().normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ')
const isbnKey = (value: string) => value.replace(/[^\dX]/gi, '').toUpperCase()

// Matching never changes ownership, reading records, circulation, or shelf locations.
export function previewWishlist(
  rows: WishlistRow[],
  library: Library,
  format: Book['format'] = 'Physical',
): WishlistPreview {
  let next = library
  let added = 0,
    updated = 0
  const entries: WishlistPreview['entries'] = []
  for (const row of rows) {
    const title = row.title.trim(),
      author = row.author.trim(),
      isbn = isbnKey(row.isbn || '')
    if (!title) throw new Error('Every book needs a title.')
    const matches = next.books.filter((b) =>
      isbn && b.isbn
        ? isbnKey(b.isbn) === isbn
        : normalize(b.title) === normalize(title) && normalize(b.author) === normalize(author),
    )
    if (matches.length > 1) {
      entries.push({ title, action: 'Needs review' })
      continue
    }
    const existing = matches[0]
    if (existing) {
      entries.push({ title, action: existing.wishlist ? 'Already listed' : 'Add to wishlist' })
      if (!existing.wishlist) {
        next = {
          ...next,
          books: next.books.map((b) =>
            b.id === existing.id
              ? { ...b, wishlist: true, updatedAt: new Date().toISOString() }
              : b,
          ),
        }
        updated++
      }
      continue
    }
    const book: Book = {
      ...blankBook(),
      title,
      author,
      isbn,
      format,
      wishlist: true,
      ownership: 'Not owned',
      notes: row.notes?.trim() || '',
      source: 'Wishlist import',
    }
    next = saveBook(next, book, row.series || '')
    added++
    entries.push({ title, action: 'Add book' })
  }
  return { library: next, entries, added, updated }
}

export function parseWishlistText(text: string): WishlistRow[] {
  const rows = text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      const parts = line.split('|')
      if (parts.length > 2)
        throw new Error(`Line ${index + 1}: use Title | Author, or just a title.`)
      return { title: parts[0].trim(), author: (parts[1] || '').trim() }
    })
  if (!rows.length) throw new Error('Add at least one book to preview.')
  if (rows.length > 2000) throw new Error('Please import at most 2,000 books at a time.')
  return rows
}

// CSV supports quoted commas, embedded line breaks, and doubled quote characters.
export function parseWishlistCsv(text: string): WishlistRow[] {
  const records: string[][] = []
  let row: string[] = [],
    field = '',
    quoted = false,
    closed = false
  const input = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        quoted = false
        closed = true
      } else field += char
    } else if (char === ',' || char === '\n' || char === '\r') {
      row.push(field)
      field = ''
      closed = false
      if (char !== ',') {
        if (row.some((value) => value.trim())) records.push(row)
        row = []
        if (char === '\r' && input[i + 1] === '\n') i++
      }
    } else if (char === '"') {
      if (field || closed)
        throw new Error('Invalid CSV quoting. Export the sheet as CSV and try again.')
      quoted = true
    } else {
      if (closed) {
        if (!char.trim()) continue
        throw new Error('Unexpected text after a quoted CSV field.')
      }
      field += char
    }
  }
  if (quoted) throw new Error('A quoted CSV field is unfinished.')
  row.push(field)
  if (row.some((value) => value.trim())) records.push(row)
  const header = records.shift()?.map(normalize) || []
  if (!header.includes('title'))
    throw new Error('Your CSV needs a Title column. Optional columns: Author, ISBN, Series, Notes.')
  if (new Set(header).size !== header.length) throw new Error('CSV column names must be unique.')
  if (!records.length) throw new Error('The CSV has no books to import.')
  if (records.length > 2000) throw new Error('Please import at most 2,000 books at a time.')
  return records.map((cells, index) => {
    if (cells.length !== header.length)
      throw new Error(`CSV row ${index + 2} has the wrong number of columns.`)
    const value = (name: string) => (cells[header.indexOf(name)] || '').trim()
    if (!value('title')) throw new Error(`CSV row ${index + 2} needs a title.`)
    return {
      title: value('title'),
      author: value('author'),
      isbn: value('isbn'),
      series: value('series'),
      notes: value('notes'),
    }
  })
}
