import { describe, expect, it } from 'vitest'
import { coverSearchUrl, normalizeIsbn, parseCoverResults } from './covers'
import { blankBook, saveBook, verificationStatus, nextBookToVerify, type Library } from './model'
import { parseBackup } from './storage'
describe('cover lookup', () => {
  it('validates ISBN checksums and constructs encoded requests without personal metadata', () => {
    expect(normalizeIsbn('978-0-06155182-6')).toBe('9780061551826')
    expect(normalizeIsbn('0061551821')).toBe('0061551821')
    expect(normalizeIsbn('9780061551827')).toBe('')
    expect(() => coverSearchUrl('isbn', 'LLS:BOOK', '', '')).toThrow('valid ISBN')
    const url = new URL(coverSearchUrl('title', '', 'Grace & Hope', 'Some Author'))
    expect(url.searchParams.get('title')).toBe('Grace & Hope')
    expect(url.searchParams.get('author')).toBe('Some Author')
  })
  it('keeps work covers edition-unverified and ignores unsafe API output', () => {
    const parsed = parseCoverResults({
      docs: [
        { key: '/works/OL123W', title: 'Example', cover_i: 456, author_name: ['An Author'] },
        { key: 'https://evil.example', title: 'Unsafe', cover_i: 1 },
      ],
    })
    expect(parsed).toHaveLength(1)
    expect(parsed[0].editionSpecific).toBe(false)
    expect(parsed[0].isbn).toBe('')
    expect(parsed[0].sourceUrl).toBe('https://openlibrary.org/works/OL123W')
    expect(
      parseCoverResults(
        { title: 'Example', covers: ['https://evil.example/image'] },
        '9780061551826',
      ),
    ).toEqual([])
    const edition = parseCoverResults(
      {
        title: 'Example',
        covers: [-1, 123],
        publishers: ['Publisher'],
        publish_date: '2008',
        physical_format: 'Hardcover',
      },
      '9780061551826',
    )[0]
    expect(edition.imageUrl).toBe('https://covers.openlibrary.org/b/id/123-L.jpg?default=false')
    expect(edition.editionSpecific).toBe(true)
    expect(edition.publication).toBe('Publisher · 2008 · Hardcover')
  })
})
describe('physical verification', () => {
  const empty = (): Library => ({
    version: 1,
    sample: false,
    books: [],
    series: [],
    loans: [],
    sermons: [],
    prayers: [],
    prayerSets: [],
    hymns: [],
    liturgies: [],
    notes: [],
  })
  it('moves forward in shelf order, wraps, and skips confirmed copies', () => {
    const books = ['1', '2', '3'].map((position) => ({
      ...blankBook(),
      title: position,
      location: { room: '', bookcase: '1', shelf: '1', position },
    }))
    const library = { ...empty(), books }
    expect(nextBookToVerify(library, books[0].id)?.id).toBe(books[1].id)
    expect(nextBookToVerify(library, books[1].id)?.id).toBe(books[2].id)
    expect(nextBookToVerify(library, books[2].id)?.id).toBe(books[0].id)
  })
  it('round-trips review and cover provenance while accepting older backups', () => {
    const book = {
      ...blankBook(),
      title: 'Example',
      sourceMetadata: { 'Catalog Confidence': 'Probable' },
    }
    expect(verificationStatus(parseBackup({ ...empty(), books: [book] }).books[0])).toBe(
      'Not checked',
    )
    const reviewed = {
      ...book,
      verification: {
        status: 'Confirmed' as const,
        checkedAt: '2026-09-28',
        notes: 'Compared on shelf',
      },
      coverSource: {
        name: 'Open Library',
        url: 'https://openlibrary.org/works/OL123W',
        selectedAt: '2026-09-28',
      },
    }
    expect(parseBackup({ ...empty(), books: [reviewed] }).books[0]).toEqual(reviewed)
    expect(() =>
      parseBackup({
        ...empty(),
        books: [{ ...reviewed, verification: { ...reviewed.verification, checkedAt: '' } }],
      }),
    ).toThrow()
  })
  it('invalidates confirmation on identity or location changes, but retains it for covers and reading', () => {
    const book = {
      ...blankBook(),
      title: 'Example',
      verification: { status: 'Confirmed' as const, checkedAt: '2026-09-28', notes: 'Checked' },
    }
    const library = { ...empty(), books: [book] }
    for (const change of [
      { title: 'Corrected' },
      { edition: '2nd edition' },
      { isbn: '9780061551826' },
      { location: { ...book.location, shelf: '4' } },
      { volume: '2' },
    ]) {
      const saved = saveBook(library, { ...book, ...change }, '').books[0]
      expect(verificationStatus(saved)).toBe('Not checked')
      expect(saved.verification?.notes).toBe('Checked')
      expect(saved.verification?.checkedAt).toBe('')
    }
    const saved = saveBook(
      library,
      {
        ...book,
        coverUrl: 'https://covers.openlibrary.org/b/id/123-L.jpg',
        reading: { ...book.reading, status: 'Read' },
      },
      '',
    ).books[0]
    expect(verificationStatus(saved)).toBe('Confirmed')
  })
})
