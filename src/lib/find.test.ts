import { describe, expect, it } from 'vitest'
import { blankBook, type Library } from './model'
import { blankNote } from './notes'
import { blankSermon } from './sermons'
import { blankHymn } from './hymns'
import { blankPrayer } from './prayers'
import { findAll, findMine } from './find'

const library = (): Library => ({
  version: 1,
  books: [{ ...blankBook(), title: 'Forgiveness and Grace', topics: [] }],
  series: [],
  loans: [],
  sermons: [
    { ...blankSermon(), title: 'Forgiveness and reconciliation', scripture: 'Matthew 18:21–35' },
    { ...blankSermon(), title: 'Forgiveness at a funeral', occasion: 'Funeral & memorial' },
  ],
  prayers: [{ ...blankPrayer(), title: 'Forgiving God', text: 'forgiveness', type: 'Bidding' }],
  prayerSets: [],
  notes: [
    { ...blankNote('Illustration'), title: 'The mended bowl', body: 'forgiveness' },
    { ...blankNote('Sermon note'), title: 'Private pastoral', body: 'forgiveness', personal: true },
  ],
  hymns: [{ ...blankHymn(), title: 'Forgive our sins as we forgive' }],
  liturgies: [],
  resources: [],
  ideaSources: [],
  visuals: [],
  sample: false,
})

describe('search everything', () => {
  it('finds each kind and leaves private things out', () => {
    const hits = findMine(library(), 'forgiveness')
    expect(hits.map((h) => h.kind).sort()).toEqual(['book', 'idea', 'prayer', 'sermon'])
    expect(hits.some((h) => /funeral|Private/i.test(h.title))).toBe(false)
  })
  it('offers research when the search is a passage', () => {
    const [first] = findMine(library(), 'Luke 15:1–7')
    expect(first).toMatchObject({ kind: 'passage', page: 'Research', seed: 'Luke 15:1–7' })
  })
  it('points to outside sources, and scopes the lists', () => {
    const outside = findAll(library(), 'lost sheep', 'Outside resources')
    expect(outside.every((r) => r.kind === 'outside' && r.url?.includes('lost'))).toBe(true)
    expect(outside.map((r) => r.title)).toContain('Working Preacher')
    expect(
      findAll(library(), 'forgiveness', 'My resources').some((r) => r.kind === 'outside'),
    ).toBe(false)
    expect(findAll(library(), '', 'Everything')).toEqual([])
  })
})
