import { describe, expect, it } from 'vitest'
import {
  blankSource,
  cite,
  html,
  initials,
  missing,
  parseName,
  plainText,
  rtfDocument,
  sortSources,
  sourceFromBook,
  splitNames,
  type Source,
} from './citations'
import { blankBook, type Library } from './model'

// Invented sources; the names belong to well-known published authors only as name shapes.
const book: Source = {
  ...blankSource(),
  authors: 'N. T. Wright',
  title: 'A Sample Book on Hope',
  series: 'Invented Studies',
  seriesNumber: '3',
  place: 'Minneapolis',
  publisher: 'Example Press',
  year: '2003',
  cited: '45-47',
}
const twoAuthors: Source = {
  ...blankSource(),
  authors: 'Stott, John; Christopher J. H. Wright',
  title: 'Mission in an Invented World',
  edition: '2',
  place: 'Downers Grove, IL',
  publisher: 'Sample House',
  year: '2015',
  cited: '12',
}
const chapter: Source = {
  ...blankSource('Chapter in an edited book'),
  authors: 'Amy-Jill Levine',
  title: 'The Lost Coin',
  container: 'Parables in an Example Volume',
  editors: 'Jane Doe; John Roe',
  pages: '10-25',
  place: 'Grand Rapids',
  publisher: 'Example Press',
  year: '2014',
  cited: '12',
}
const article: Source = {
  ...blankSource('Journal article'),
  authors: 'Michael S. Heiser',
  title: 'An Invented Article on Deuteronomy',
  container: 'Journal of Examples',
  volume: '158',
  issue: '629',
  year: '2001',
  pages: '52-74',
  cited: '60',
}

describe('names', () => {
  it('reads names written either way, with suffixes and particles', () => {
    expect(parseName('N. T. Wright')).toEqual({ first: 'N. T.', last: 'Wright', suffix: '' })
    expect(parseName('Wright, N. T.')).toEqual({ first: 'N. T.', last: 'Wright', suffix: '' })
    expect(parseName('Martin Luther King Jr.')).toMatchObject({ last: 'King', suffix: 'Jr.' })
    expect(parseName('Gerhard von Rad')).toMatchObject({ first: 'Gerhard', last: 'von Rad' })
    expect(splitNames('John Stott and N. T. Wright').map((n) => n.last)).toEqual([
      'Stott',
      'Wright',
    ])
    expect(splitNames('Stott, John').map((n) => n.last)).toEqual(['Stott'])
    expect(initials('Jean-Paul George')).toBe('J.-P. G.')
  })
})

describe('Chicago notes and bibliography', () => {
  it('formats a book in a series with full and short notes', () => {
    const c = cite(book, 'chicago')
    expect(html(c.entry)).toBe(
      'Wright, N. T. <i>A Sample Book on Hope</i>. Invented Studies 3. Minneapolis: Example Press, 2003.',
    )
    expect(plainText(c.note!)).toBe(
      'N. T. Wright, A Sample Book on Hope, Invented Studies 3 (Minneapolis: Example Press, 2003), 45–47.',
    )
    expect(plainText(c.shortNote!)).toBe('Wright, A Sample Book, 45–47.')
  })
  it('formats two authors and an edition', () => {
    expect(plainText(cite(twoAuthors, 'chicago').entry)).toBe(
      'Stott, John, and Christopher J. H. Wright. Mission in an Invented World. 2nd ed. Downers Grove, IL: Sample House, 2015.',
    )
  })
  it('formats a chapter and an article', () => {
    expect(plainText(cite(chapter, 'chicago').entry)).toBe(
      'Levine, Amy-Jill. “The Lost Coin.” In Parables in an Example Volume, edited by Jane Doe and John Roe, 10–25. Grand Rapids: Example Press, 2014.',
    )
    expect(plainText(cite(article, 'chicago').note!)).toBe(
      'Michael S. Heiser, “An Invented Article on Deuteronomy,” Journal of Examples 158, no. 629 (2001): 60.',
    )
  })
  it('puts an editor in the author place when there is no author', () => {
    const edited = {
      ...blankSource(),
      editors: 'Carmen Joy Imes',
      title: 'Collected',
      publisher: 'P',
      place: 'X',
      year: '2020',
    }
    expect(plainText(cite(edited, 'chicago').entry)).toBe(
      'Imes, Carmen Joy, ed. Collected. X: P, 2020.',
    )
  })
})

describe('the other styles', () => {
  it('author-date moves the year after the names', () => {
    const c = cite(book, 'chicago-ad')
    expect(plainText(c.entry)).toBe(
      'Wright, N. T. 2003. A Sample Book on Hope. Invented Studies 3. Minneapolis: Example Press.',
    )
    expect(plainText(c.inText!)).toBe('(Wright 2003, 45–47)')
  })
  it('SBL writes volume and issue together', () => {
    expect(plainText(cite(article, 'sbl').entry)).toContain(
      'Journal of Examples 158.629 (2001): 52–74.',
    )
  })
  it('MLA', () => {
    expect(plainText(cite(chapter, 'mla').entry)).toBe(
      'Levine, Amy-Jill. “The Lost Coin.” Parables in an Example Volume, edited by Jane Doe and John Roe, Example Press, 2014, pp. 10–25.',
    )
    expect(plainText(cite(twoAuthors, 'mla').inText!)).toBe('(Stott and Wright 12)')
  })
  it('APA', () => {
    const c = cite(twoAuthors, 'apa')
    expect(html(c.entry)).toBe(
      'Stott, J., &amp; Wright, C. J. H. (2015). <i>Mission in an Invented World</i> (2nd ed.). Sample House.',
    )
    expect(plainText(c.inText!)).toBe('(Stott & Wright, 2015, p. 12)')
    expect(html(cite(article, 'apa').entry)).toBe(
      'Heiser, M. S. (2001). An Invented Article on Deuteronomy. <i>Journal of Examples</i>, <i>158</i>(629), 52–74.',
    )
  })
})

describe('lists and export', () => {
  it('sorts by surname, ignoring a leading article in titles', () => {
    const untitled = {
      ...blankSource('Website'),
      title: 'The Zebra Page',
      url: 'https://example.org',
    }
    expect(sortSources([book, chapter, untitled, twoAuthors]).map((s) => s.title)).toEqual([
      'The Lost Coin',
      'Mission in an Invented World',
      'A Sample Book on Hope',
      'The Zebra Page',
    ])
  })
  it('says what a style still needs', () => {
    expect(missing({ ...book, place: '' }, 'chicago')).toEqual(['place of publication'])
    expect(missing({ ...book, place: '' }, 'mla')).toEqual([])
    expect(plainText(cite({ ...book, publisher: '' }, 'chicago').entry)).toContain(
      'Invented Studies 3. Minneapolis, 2003.',
    )
  })
  it('turns a library book into a source', () => {
    const library = { series: [{ id: 's', name: 'Invented Series' }] } as unknown as Library
    const s = sourceFromBook(
      {
        ...blankBook(),
        title: 'Main: The Subtitle',
        author: 'A. B. Example',
        publisher: 'P',
        year: 'c. 1999',
        seriesId: 's',
        volume: '4',
      },
      library,
    )
    expect(s).toMatchObject({
      title: 'Main',
      subtitle: 'The Subtitle',
      year: '1999',
      series: 'Invented Series',
      seriesNumber: '4',
    })
  })
  it('writes a document with italics and escaped characters', () => {
    const doc = rtfDocument('Bibliography', [cite(chapter, 'chicago').entry])
    expect(doc).toContain('{\\i Parables in an Example Volume}')
    expect(doc).toContain('\\u8220?The Lost Coin.\\u8221?')
    expect(doc.startsWith('{\\rtf1')).toBe(true)
  })
})
