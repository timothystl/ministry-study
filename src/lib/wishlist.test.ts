import { describe, expect, it } from 'vitest'
import { blankBook, type Library } from './model'
import { parseWishlistCsv, parseWishlistText, previewWishlist } from './wishlist'
const empty = (): Library => ({
  version: 1,
  books: [],
  series: [],
  loans: [],
  sermons: [],
  prayers: [],
  prayerSets: [],
  sample: false,
})

describe('wishlist imports', () => {
  it('reads spreadsheet CSV with BOM, quoted commas, escaped quotes and multiline notes', () => {
    const rows = parseWishlistCsv(
      '\uFEFFTitle,Author,ISBN,Series,Notes\r\n"Grace, Faith",Example,9780061551826,Studies,"Line one\nA ""quote"""\r\n',
    )
    expect(rows).toEqual([
      {
        title: 'Grace, Faith',
        author: 'Example',
        isbn: '9780061551826',
        series: 'Studies',
        notes: 'Line one\nA "quote"',
      },
    ])
    const result = previewWishlist(rows, empty())
    expect(result.library.books[0]).toMatchObject({
      ownership: 'Not owned',
      wishlist: true,
      reading: { status: 'Not recorded' },
      location: { shelf: '' },
    })
    expect(result.library.series[0].name).toBe('Studies')
  })
  it('rejects malformed files instead of partially importing them', () => {
    expect(() => parseWishlistCsv('Author\nExample')).toThrow('Title column')
    expect(() => parseWishlistCsv('Title,Author\nBook')).toThrow('number of columns')
    expect(() => parseWishlistCsv('Title\n"Unclosed')).toThrow('unfinished')
    expect(() => parseWishlistCsv('Title,Author\n,Example')).toThrow('needs a title')
    expect(() => parseWishlistText('')).toThrow('at least one')
  })
  it('adds only wishlist status to matching records without changing other concepts', () => {
    const book = {
      ...blankBook(),
      title: 'My Book',
      author: 'Example',
      isbn: '978-0-061-55182-6',
      notes: 'Keep this note',
      reading: { ...blankBook().reading, status: 'Read' as const },
      location: { room: 'Office', bookcase: '2', shelf: '4', position: '1' },
    }
    const original = { ...empty(), books: [book] }
    const result = previewWishlist(
      [
        {
          title: 'Another display title',
          author: 'Other',
          isbn: '9780061551826',
          notes: 'Do not overwrite',
        },
      ],
      original,
    )
    expect(result.updated).toBe(1)
    expect(result.added).toBe(0)
    expect(result.library.books[0]).toMatchObject({
      ...book,
      wishlist: true,
      updatedAt: expect.any(String),
    })
    expect(original.books[0].wishlist).toBe(false)
    expect(previewWishlist([{ title: 'My Book', author: 'Example' }], result.library).updated).toBe(
      0,
    )
  })
  it('deduplicates repeated rows, preserves different editions, and skips ambiguous matches', () => {
    const rows = parseWishlistText(' My Book | Example\nmy book | EXAMPLE')
    const first = previewWishlist(rows, empty())
    expect(first.added).toBe(1)
    expect(first.entries[1].action).toBe('Already listed')
    const a = { ...blankBook(), title: 'My Book', author: 'Example', isbn: '9780061551826' }
    const b = { ...a, id: 'another', isbn: '9780061551833' }
    const library = { ...empty(), books: [a, b] }
    expect(previewWishlist([rows[0]], library).entries[0].action).toBe('Needs review')
    expect(previewWishlist([{ ...rows[0], isbn: b.isbn }], library).updated).toBe(1)
  })
})
