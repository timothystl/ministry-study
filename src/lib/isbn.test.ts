import { expect, it } from 'vitest'
import { applyEditionIsbn, editionsUrl, isbnEditions, isbnWorks } from './isbn'
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
