import { describe, expect, it } from 'vitest'
import { amazonListUrl, parseAmazonText } from './amazon'
import { previewWishlist } from './wishlist'
import { blankBook, type Library } from './model'
import { parseBackup } from './storage'
const empty = (): Library => ({
  version: 1,
  books: [],
  loans: [],
  series: [],
  sermons: [],
  prayers: [],
  prayerSets: [],
  notes: [],
  sample: false,
})
describe('Amazon wishlist imports', () => {
  it('accepts only Amazon wishlist URLs and removes tracking parameters', () => {
    expect(amazonListUrl('https://www.amazon.com/hz/wishlist/ls/EXAMPLE?ref_=wl_share')).toBe(
      'https://www.amazon.com/hz/wishlist/ls/EXAMPLE',
    )
    for (const url of [
      'https://amazon.com.evil.test/hz/wishlist/ls/A',
      'javascript:alert(1)',
      'https://user:pass@amazon.com/hz/wishlist/ls/A',
      'https://www.amazon.com/dp/0060693339',
      'https://www.amazon.com:444/hz/wishlist/ls/A',
    ])
      expect(() => amazonListUrl(url)).toThrow()
  })
  it('finds author/title pairs and keeps prices and Amazon ratings out of reading history', () => {
    const parsed = parseAmazonText(
      'Theology\nAn Example Book\nby Example Author (Paperback)\n4.9 out of 5 stars\n$9.99\nAdd to Cart\nA Digital Book\nby Another Author (Kindle Edition)\nFormat : Kindle\nA Notebook\n$12.00\nEnd of list',
    )
    expect(parsed.items).toHaveLength(2)
    expect(parsed.items[1].format).toBe('Kindle')
    const imported = previewWishlist(parsed.items, empty()).library
    expect(imported.books[0].reading).toMatchObject({ status: 'Not recorded', rating: 0 })
    expect(imported.books[0].ownership).toBe('Not owned')
    expect(parseBackup(imported).books[1].format).toBe('Kindle')
    expect(() => parseAmazonText('https://www.amazon.com/hz/wishlist/ls/EXAMPLE')).toThrow(
      'No book titles',
    )
  })
  it('matches ISBN-10 with ISBN-13 and keeps Kindle distinct from physical books', () => {
    const book = { ...blankBook(), title: 'A Print Book', author: 'Author', isbn: '9780060693336' }
    const library = { ...empty(), books: [book] }
    expect(
      previewWishlist(
        [{ title: 'Alternate title', author: 'Author', isbn: '0060693339', format: 'Physical' }],
        library,
      ).updated,
    ).toBe(1)
    const digital = previewWishlist(
      [
        {
          title: book.title,
          author: book.author,
          format: 'Kindle',
          source: 'Amazon wishlist',
          sourceId: 'B012345678',
        },
      ],
      library,
    )
    expect(digital.added).toBe(1)
    expect(
      previewWishlist(
        [
          {
            title: 'Updated display title',
            author: 'Author',
            format: 'Kindle',
            source: 'Amazon wishlist',
            sourceId: 'B012345678',
          },
        ],
        digital.library,
      ).added,
    ).toBe(0)
  })
})
