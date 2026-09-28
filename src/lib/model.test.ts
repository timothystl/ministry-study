import { describe, it, expect } from 'vitest'
import { blankBook, lendBook, saveBook, searchBooks, type Library } from './model'
import { importLogos, parseBackup } from './storage'
const empty = (): Library => ({ version: 1, books: [], series: [], loans: [], sample: false })
const physical = () => ({ ...blankBook(), title: 'Test book' })
describe('independent library concepts', () => {
  it('records reading without ownership or physical location', () => {
    const b = physical()
    b.ownership = 'Not owned'
    b.reading.status = 'Read'
    b.reading.source = 'Public library'
    b.wishlist = true
    const library = saveBook(empty(), b, '')
    expect(library.books[0].ownership).toBe('Not owned')
    expect(library.books[0].reading.status).toBe('Read')
    expect(library.books[0].wishlist).toBe(true)
    expect(library.books[0].location.room).toBe('')
  })
  it('keeps current and recommended locations independent through lending and returns', () => {
    const b = physical()
    b.location.shelf = '4'
    b.recommendedLocation.shelf = '7'
    const library = saveBook(empty(), b, '')
    const loan = {
      id: 'l',
      bookId: b.id,
      borrower: 'Reader',
      loanedAt: '2026-09-01',
      dueAt: '',
      returnedAt: '',
      notes: '',
    }
    const lent = lendBook(library, loan)
    expect(lent.books).toEqual(library.books)
    expect(() => lendBook(lent, { ...loan, id: 'l2' })).toThrow('already loaned')
    expect(() => saveBook(lent, { ...b, ownership: 'Not owned' }, '')).toThrow(
      'Return the active loan',
    )
    const returned = { ...lent, loans: [{ ...loan, returnedAt: '2026-09-02' }] }
    expect(lendBook(returned, { ...loan, id: 'l3' }).loans).toHaveLength(2)
    expect(returned.books[0].location.shelf).toBe('4')
    expect(returned.books[0].recommendedLocation.shelf).toBe('7')
  })
  it('does not lend digital or unowned books and rejects invalid dates', () => {
    const b = physical()
    b.format = 'Logos'
    const l = {
      id: 'l',
      bookId: b.id,
      borrower: 'R',
      loanedAt: '2026-09-10',
      dueAt: '2026-09-01',
      returnedAt: '',
      notes: '',
    }
    expect(() => lendBook({ ...empty(), books: [b] }, l)).toThrow('owned physical')
    b.format = 'Physical'
    expect(() => lendBook({ ...empty(), books: [b] }, l)).toThrow('dates')
  })
  it('reuses series records while keeping copies distinct', () => {
    const one = saveBook(empty(), physical(), 'A series'),
      two = saveBook(one, physical(), 'a series')
    expect(two.series).toHaveLength(1)
    expect(two.books).toHaveLength(2)
    expect(two.books[0].id).not.toBe(two.books[1].id)
  })
  it('searches notes, series, subjects, author, and actual location without indexing provenance', () => {
    const b = physical()
    b.author = 'Some Author'
    b.notes = 'A reflection on grace'
    b.topics = ['Theology']
    b.location.shelf = '2'
    b.sourceMetadata = { Secret: 'provenance-only' }
    const lib = saveBook(empty(), b, 'Collected Essays')
    expect(searchBooks(lib, 'grace author')).toHaveLength(1)
    expect(searchBooks(lib, 'collected')).toHaveLength(1)
    expect(searchBooks(lib, 'shelf 2')).toHaveLength(1)
    expect(searchBooks(lib, 'provenance-only')).toHaveLength(0)
  })
})
describe('imports and backups', () => {
  const rows = [
    {
      'Resource ID': 'LLS:1',
      Title: 'One',
      Authors: 'Author',
      License: 'Permanent',
      Series: 'Collected',
    },
    {
      'Resource ID': 'LLS:2',
      Title: 'Two',
      Authors: 'Author',
      License: 'Temporary',
      Series: 'Collected',
    },
  ]
  it('preserves original metadata and license distinctions, and skips existing IDs', () => {
    const imported = importLogos(rows, empty())
    expect(imported.added).toBe(2)
    expect(imported.library.series).toHaveLength(1)
    expect(imported.library.books[0].ownership).toBe('Owned')
    expect(imported.library.books[1].ownership).toBe('Not owned')
    expect(imported.library.books[1].license).toBe('Temporary')
    expect(imported.library.books[0].sourceMetadata).toEqual(rows[0])
    expect(imported.library.books[0].reading.status).toBe('Not recorded')
    const edited = {
      ...imported.library,
      books: imported.library.books.map((b) => ({ ...b, notes: 'Keep my edits' })),
    }
    const again = importLogos(rows, edited)
    expect(again.added).toBe(0)
    expect(again.skipped).toBe(2)
    expect(again.library.books[0].notes).toBe('Keep my edits')
  })
  it('round-trips backups and rejects broken references and duplicate IDs', () => {
    const lib = importLogos(rows, empty()).library
    expect(parseBackup(JSON.parse(JSON.stringify(lib)))).toEqual(lib)
    expect(() => parseBackup({ ...lib, series: [] })).toThrow('Missing series')
    expect(() => parseBackup({ ...lib, books: [...lib.books, lib.books[0]] })).toThrow('Duplicate')
    expect(() => parseBackup({ ...lib, version: 99 })).toThrow()
    expect(() => importLogos([{ Title: 'Missing resource ID' }], empty())).toThrow('Resource ID')
  })
})

it('keeps manually added books when replacing illustrative samples', () => {
  const own = physical()
  const library = { ...empty(), sample: true, books: [{ ...physical(), id: 'sample-0' }, own] }
  const result = importLogos([{ 'Resource ID': 'LLS:3', Title: 'Imported' }], library)
  expect(result.library.books.some((b) => b.id === own.id)).toBe(true)
  expect(result.library.books.some((b) => b.id === 'sample-0')).toBe(false)
})

it('preserves optional cover, use-for and recent-view fields through backups', () => {
  const b = {
    ...physical(),
    coverUrl: 'https://example.com/cover.jpg',
    subtitle: 'A subtitle',
    useFor: ['Sermon'],
  }
  const library = { ...saveBook(empty(), b, ''), recentIds: [b.id] }
  const restored = parseBackup(JSON.parse(JSON.stringify(library)))
  expect(restored.books[0].useFor).toEqual(['Sermon'])
  expect(restored.recentIds).toEqual([b.id])
  expect(() => saveBook(empty(), { ...b, coverUrl: 'http://insecure.example/cover' }, '')).toThrow(
    'HTTPS',
  )
})
