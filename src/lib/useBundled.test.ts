import { describe, expect, it } from 'vitest'
import type { RufEntry } from './hymns'
import { blankHymn } from './hymns'
import type { Library } from './model'
import { blankResource, type BundledResource } from './resources'
import { planBundled } from './useBundled'

const empty = (): Library => ({
  version: 1,
  books: [],
  series: [],
  loans: [],
  sermons: [],
  prayers: [],
  prayerSets: [],
  notes: [],
  hymns: [],
  liturgies: [],
  resources: [],
  ideaSources: [],
  visuals: [],
  sample: false,
})
const ruf: RufEntry[] = [
  {
    id: 'a01',
    title: 'A Mighty Fortress',
    lyricist: 'Martin Luther',
    composer: 'Martin Luther',
    arranger: '',
    copyright: '',
    page: 'https://example.org/a01',
    lead: '',
    leadCapo: '',
    overhead: '',
    chords: '',
    demo: '',
  },
]
const list: BundledResource[] = [
  {
    id: 'r1',
    kind: 'Album',
    title: 'Love Unknown',
    creator: '',
    year: '2001',
    place: '',
    link: '',
    notes: '',
    tags: [],
  },
]

describe('bundled lists', () => {
  it('adds both lists to an empty library', () => {
    const next = planBundled(empty(), ruf, list)!
    expect(next.hymns.map((h) => h.id)).toEqual(['ruf-a01'])
    expect(next.resources.map((r) => r.id)).toEqual(['retuned-r1'])
  })
  it('adds a list only if none of its records are there, so removals stay removed', () => {
    const withHymn = {
      ...empty(),
      hymns: [{ ...blankHymn(), title: 'X', source: 'RUF Hymnbook', sourceId: 'zz' }],
    }
    const next = planBundled(withHymn, ruf, list)!
    expect(next.hymns).toHaveLength(1)
    expect(next.resources).toHaveLength(1)
    const both = planBundled(next, ruf, list)
    expect(both).toBeNull()
    const handmade = { ...empty(), resources: [{ ...blankResource(), title: 'Mine' }] }
    expect(planBundled(handmade, null, list)!.resources).toHaveLength(2)
  })
})
