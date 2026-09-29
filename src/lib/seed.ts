import { blankBook, type Library } from './model'
// Bibliographic examples from the selected mockup. All personal relationships are fictional.
const examples = [
  {
    title: 'Surprised by Hope',
    subtitle: 'Rethinking Heaven, the Resurrection, and the Mission of the Church',
    author: 'N. T. Wright',
    isbn: '9780061551826',
    publisher: 'HarperOne',
    year: '2008',
    asset: 'surprised-by-hope',
    topics: ['Theology', 'Eschatology', 'Resurrection', 'Church', 'Mission'],
  },
  {
    title: 'The Cross of Christ',
    author: 'John Stott',
    isbn: '9780830833207',
    publisher: 'IVP',
    year: '2006',
    asset: 'cross-of-christ',
    topics: ['Theology', 'Atonement'],
  },
  {
    title: 'Basics of Biblical Greek Grammar',
    author: 'William D. Mounce',
    isbn: '9780310514466',
    publisher: 'Zondervan',
    year: '2009',
    asset: 'biblical-greek',
    topics: ['Biblical Languages', 'Greek'],
  },
  {
    title: 'A Theology of the New Testament',
    author: 'George Eldon Ladd',
    isbn: '9780802806802',
    publisher: 'Eerdmans',
    year: '1993',
    asset: 'new-testament-theology',
    topics: ['Theology', 'New Testament'],
  },
  {
    title: 'The Meaning of Marriage',
    author: 'Timothy Keller; Kathy Keller',
    isbn: '9781594631870',
    publisher: 'Penguin Books',
    year: '2013',
    asset: 'meaning-of-marriage',
    topics: ['Marriage', 'Christian Life'],
  },
  {
    title: 'Gentle and Lowly',
    author: 'Dane Ortlund',
    isbn: '9781433566134',
    publisher: 'Crossway',
    year: '2020',
    asset: 'gentle-and-lowly',
    topics: ['Christian Life', 'Theology'],
  },
]
export function sampleLibrary(): Library {
  const books = examples.map((entry, i) => ({
    ...blankBook(),
    ...entry,
    id: `sample-${i}`,
    coverUrl: `/assets/${entry.asset}.jpg`,
    ownership: i === 4 ? ('Not owned' as const) : ('Owned' as const),
    wishlist: i === 4,
    reading: {
      status: i === 2 ? ('Reference' as const) : i === 5 ? ('Reading' as const) : ('Read' as const),
      started: '',
      finished: i === 5 || i === 2 ? '' : '2026-09-01',
      rating: i === 0 ? 5 : i === 2 ? 0 : 4,
      source: i === 4 ? 'Example: public library' : '',
    },
    location:
      i === 4
        ? { room: '', bookcase: '', shelf: '', position: '' }
        : { room: '', bookcase: '2', shelf: '4', position: String(i + 12) },
    source: 'Illustrative sample — not your holdings',
    useFor: i === 0 ? ['Sermon', 'Bible Study'] : [],
    summary:
      i === 0
        ? 'A study of Christian hope, resurrection, and the church’s mission in the world. This is a sample catalog summary.'
        : '',
    notes:
      i === 0
        ? 'Example note: Return to the connection between resurrection hope and the church’s life and mission.'
        : '',
  }))
  return {
    version: 1,
    books,
    series: [],
    loans: [],
    sermons: [],
    prayers: [],
    prayerSets: [],
    hymns: [],
    liturgies: [],
    resources: [],
    notes: [],
    sample: true,
    recentIds: books.map((b) => b.id),
  }
}
