import { expect, it } from 'vitest'
import { applyEditionIsbn, editionFromRecord, editionsUrl, isbnEditions, isbnWorks } from './isbn'
import { blankBook } from './model'
it('keeps editions distinct, validates identifiers and does not require a cover', () => {
  expect(
    isbnWorks({
      docs: [
        { key: '/works/OL1W', title: 'A book' },
        { key: 'https://evil.example', title: 'Unsafe' },
      ],
    }),
  ).toHaveLength(1)
  expect(() => editionsUrl('https://evil.example', 0)).toThrow()
  const result = isbnEditions({
    size: 2,
    entries: [
      {
        key: '/books/OL1M',
        title: 'A book',
        isbn_13: ['9780061551826', '9780061551827'],
        isbn_10: ['0061551821'],
        physical_format: 'Hardcover',
      },
      { key: '/books/OL2M', title: 'An old edition' },
    ],
  })
  expect(result.editions).toHaveLength(2)
  expect(result.editions[0].isbns).toEqual(['9780061551826', '0061551821'])
  expect(result.editions[1].isbns).toEqual([])
  const b = {
    ...blankBook(),
    title: 'My title',
    notes: 'Keep me',
    sourceMetadata: { Original: 'Keep original' },
  }
  const updated = applyEditionIsbn(b, result.editions[0], '9780061551826')
  expect(updated.title).toBe(b.title)
  expect(updated.notes).toBe(b.notes)
  expect(updated.location).toEqual(b.location)
  expect(updated.sourceMetadata?.Original).toBe('Keep original')
  expect(updated.isbn).toBe('9780061551826')
  expect(() => applyEditionIsbn(b, result.editions[1], '9780061551826')).toThrow()
})

it('reads an edition cover and saves it with the ISBN only when asked', () => {
  const { editions } = isbnEditions({
    entries: [
      { key: '/books/OL1M', title: 'A book', isbn_13: ['9780061551826'], covers: [-1, 8231856] },
      { key: '/books/OL2M', title: 'No cover', isbn_13: ['9780061551826'], covers: [] },
    ],
  })
  expect(editions[0].coverUrl).toBe(
    'https://covers.openlibrary.org/b/id/8231856-L.jpg?default=false',
  )
  expect(editions[1].coverUrl).toBe('')
  const b = { ...blankBook(), title: 'Mine', coverUrl: '/assets/unidentified-cover.png' }
  expect(applyEditionIsbn(b, editions[0], '9780061551826').coverUrl).toBe(b.coverUrl)
  const both = applyEditionIsbn(b, editions[0], '9780061551826', true)
  expect(both.coverUrl).toBe(editions[0].coverUrl)
  expect(both.coverSource).toMatchObject({
    name: 'Open Library',
    url: 'https://openlibrary.org/books/OL1M',
  })
  expect(both.title).toBe('Mine')
  expect(applyEditionIsbn(b, editions[1], '9780061551826', true).coverUrl).toBe(b.coverUrl)
})
it('reads the edition found directly by ISBN', () => {
  const edition = editionFromRecord(
    { key: '/books/OL9M', title: 'Exact', covers: [5], isbn_10: ['0061551821'] },
    '978-0-06-155182-6',
  )
  expect(edition?.isbns).toEqual(['9780061551826', '0061551821'])
  expect(edition?.coverUrl).toContain('/5-L.jpg')
  expect(editionFromRecord({ nothing: true })).toBeNull()
})
