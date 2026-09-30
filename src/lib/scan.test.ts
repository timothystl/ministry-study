import { describe, expect, it } from 'vitest'
import { blankBook, saveBook, type Library } from './model'
import { applyScan, isbnFromCode, lookupIsbn, matchBooks, newBookFromScan, toIsbn13 } from './scan'
import { cleanSummary, googleBooksVolume, openLibrarySummary } from './summary'

const empty = (): Library => ({
  version: 1,
  books: [],
  series: [],
  loans: [],
  sermons: [],
  prayers: [],
  prayerSets: [],
  hymns: [],
  liturgies: [],
  resources: [],
  ideaSources: [],
  notes: [],
  sample: false,
})
const ISBN = '9780061551826'

describe('barcodes and ISBNs', () => {
  it('accepts book barcodes and rejects other codes', () => {
    expect(isbnFromCode('9780061551826')).toBe(ISBN)
    expect(isbnFromCode('978-0-06-155182-6')).toBe(ISBN)
    expect(isbnFromCode('0061551821')).toBe(ISBN)
    expect(isbnFromCode('0049000028911')).toBe('') // a soda can
    expect(isbnFromCode('9780061551827')).toBe('') // bad check digit
    expect(isbnFromCode('123')).toBe('')
  })
  it('converts ISBN-10 to ISBN-13', () => {
    expect(toIsbn13('0061551821')).toBe(ISBN)
    expect(toIsbn13('nope')).toBe('')
  })
})

describe('published summaries', () => {
  it('cleans Open Library and Google descriptions', () => {
    expect(cleanSummary('A <b>great</b> book.<br>Really.&nbsp;Yes &amp; more.')).toBe(
      'A great book.\nReally. Yes & more.',
    )
    expect(
      cleanSummary('About it. ([source][1])\n\n[1]: https://x.example\n----------\nContains: junk'),
    ).toBe('About it.')
    expect(cleanSummary('See [this link](https://x.example) now')).toBe('See this link now')
    expect(cleanSummary('A. '.repeat(1500)).length).toBeLessThanOrEqual(2001)
  })
  it('reads both description shapes and Google volumes', () => {
    expect(openLibrarySummary({ description: 'Plain.' }, 'u')).toMatchObject({
      text: 'Plain.',
      source: 'Open Library',
    })
    expect(
      openLibrarySummary({ description: { type: '/type/text', value: 'Typed.' } }, 'u')?.text,
    ).toBe('Typed.')
    expect(openLibrarySummary({}, 'u')).toBeNull()
    const g = googleBooksVolume({
      items: [
        {
          id: 'abc',
          volumeInfo: {
            title: 'T',
            authors: ['A', 'B'],
            publishedDate: '2008-05-01',
            description: '<p>Words.</p>',
            imageLinks: { thumbnail: 'http://books.google.com/x&edge=curl' },
          },
        },
      ],
    })
    expect(g).toMatchObject({
      authors: 'A; B',
      year: '2008',
      coverUrl: 'https://books.google.com/x',
    })
    expect(g?.summary).toMatchObject({ text: 'Words.', source: 'Google Books' })
    expect(googleBooksVolume({ items: [] })).toBeNull()
  })
})

describe('looking up a scanned ISBN', () => {
  const answers: Record<string, unknown> = {
    [`https://openlibrary.org/isbn/${ISBN}.json`]: {
      title: 'Surprised by Hope',
      publishers: ['HarperOne'],
      publish_date: 'Mar 2008',
      covers: [-1, 1234],
      works: [{ key: '/works/OL1W' }],
    },
    'https://openlibrary.org/works/OL1W.json': {
      description: { value: 'Resurrection and the church.' },
    },
  }
  const get = async (url: string) => {
    if (url.includes('search.json'))
      return {
        docs: [{ key: '/works/OL1W', title: 'Surprised by Hope', author_name: ['N. T. Wright'] }],
      }
    if (url.includes('googleapis')) return null
    return answers[url] ?? null
  }
  it('combines the edition, authors, cover and summary', async () => {
    const result = await lookupIsbn('0061551821', get)
    expect(result).toMatchObject({
      isbn: ISBN,
      title: 'Surprised by Hope',
      authors: 'N. T. Wright',
      publisher: 'HarperOne',
      year: '2008',
      coverUrl: 'https://covers.openlibrary.org/b/id/1234-L.jpg?default=false',
    })
    expect(result?.summary).toMatchObject({
      text: 'Resurrection and the church.',
      source: 'Open Library',
    })
  })
  it('falls back to Google Books and reports an unknown ISBN', async () => {
    const google = async (url: string) =>
      url.includes('googleapis')
        ? {
            items: [
              {
                id: 'g1',
                volumeInfo: { title: 'Only Google', authors: ['G'], description: 'From Google.' },
              },
            ],
          }
        : null
    const result = await lookupIsbn(ISBN, google)
    expect(result).toMatchObject({ title: 'Only Google', authors: 'G' })
    expect(result?.summary?.source).toBe('Google Books')
    expect(await lookupIsbn(ISBN, async () => null)).toBeNull()
    expect(await lookupIsbn('123', get)).toBeNull()
  })
  const scanned = {
    isbn: ISBN,
    title: 'Surprised by Hope: Rethinking Heaven',
    subtitle: '',
    authors: 'N. T. Wright',
    publisher: 'HarperOne',
    year: '2008',
    coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg',
    coverSource: { name: 'Open Library', url: 'https://openlibrary.org/isbn/x' },
    sourceUrl: 'https://openlibrary.org/isbn/x',
    summary: { text: 'About.', source: 'Open Library', url: 'https://openlibrary.org/works/OL1W' },
  }
  it('matches existing books without an ISBN; the scan replaces publication details only', () => {
    const mine = {
      ...blankBook(),
      title: 'Surprised by Hope',
      author: 'Wright, N. T.',
      notes: 'Keep me',
      publisher: 'My press',
    }
    const other = { ...blankBook(), title: 'Simply Christian', author: 'N. T. Wright' }
    const library = saveBook(saveBook(empty(), mine, ''), other, '')
    const { sameIsbn, similar } = matchBooks(library, scanned)
    expect(sameIsbn).toEqual([])
    expect(similar.map((b) => b.title)).toEqual(['Surprised by Hope'])
    const updated = applyScan(mine, scanned, { cover: true, summary: true })
    expect(updated).toMatchObject({
      isbn: ISBN,
      author: 'N. T. Wright',
      publisher: 'HarperOne',
      year: '2008',
      title: 'Surprised by Hope',
      notes: 'Keep me',
      summary: 'About.',
    })
    expect(updated.sourceMetadata?.['Summary source']).toContain('Open Library')
    expect(applyScan(mine, scanned, { cover: false, summary: false }).coverUrl).toBeUndefined()
  })
  it('recognizes a book already scanned, and builds a new owned physical book', () => {
    const book = newBookFromScan(scanned, true)
    expect(book).toMatchObject({
      format: 'Physical',
      ownership: 'Owned',
      isbn: ISBN,
      source: 'Barcode scan',
    })
    expect(matchBooks(saveBook(empty(), book, ''), scanned).sameIsbn).toHaveLength(1)
  })
})
