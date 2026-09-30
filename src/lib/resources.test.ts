import { describe, expect, it } from 'vitest'
import type { Library } from './model'
import {
  allTags,
  blankResource,
  deleteResource,
  resourcesFromBundle,
  saveResource,
  searchResources,
  type BundledResource,
} from './resources'
import bundled from '../../public/data/retuned-resources.json?raw'

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
  sample: false,
})
const res = (over = {}) => ({ ...blankResource(), title: 'Untitled', ...over })

describe('music resources', () => {
  it('saves, validates, edits and removes', () => {
    const r = res({ id: 'a', title: ' Indelible Grace ', kind: 'Artist', tags: [' hymns ', ''] })
    let lib = saveResource(empty(), r)
    expect(lib.resources[0]).toMatchObject({ title: 'Indelible Grace', tags: ['hymns'] })
    lib = saveResource(lib, { ...r, title: 'Indelible Grace Music' })
    expect(lib.resources).toHaveLength(1)
    expect(() => saveResource(lib, res({ title: '' }))).toThrow(/title/)
    expect(() => saveResource(lib, res({ year: '96' }))).toThrow(/year/)
    expect(() => saveResource(lib, res({ link: 'not a link' }))).toThrow(/web address/)
    expect(deleteResource(lib, 'a').resources).toEqual([])
  })
  it('searches every word across the fields and filters by kind and tag', () => {
    const items = [
      res({
        id: '1',
        title: 'Love Unknown',
        kind: 'Album',
        creator: 'Auburn RUF',
        year: '2001',
        tags: ['Retuned'],
      }),
      res({ id: '2', title: 'Old Texts, New Sounds', kind: 'Article', creator: 'Emily Brink' }),
    ]
    expect(searchResources(items, 'auburn 2001').map((r) => r.id)).toEqual(['1'])
    expect(searchResources(items, '', { kind: 'Article' }).map((r) => r.id)).toEqual(['2'])
    expect(searchResources(items, '', { tag: 'Retuned' }).map((r) => r.id)).toEqual(['1'])
    expect(allTags(items)).toEqual(['Retuned'])
  })
  it('brings in the bundled Retuned Hymn Movement list once', () => {
    const entries = JSON.parse(bundled) as BundledResource[]
    expect(entries.length).toBeGreaterThan(400)
    const { resources } = resourcesFromBundle(entries, empty())
    expect(resources).toHaveLength(entries.length)
    expect(new Set(resources.map((r) => r.kind))).toEqual(
      new Set(['Artist', 'Album', 'Article', 'Book']),
    )
    expect(resources.every((r) => !r.link || /^https?:\/\//.test(r.link))).toBe(true)
    const again = resourcesFromBundle(entries, { ...empty(), resources })
    expect(again.skipped).toBe(entries.length)
    expect(again.resources).toEqual([])
    // every bundled entry passes the same checks as one typed in
    let lib = empty()
    for (const r of resources) lib = saveResource(lib, r)
    expect(lib.resources).toHaveLength(entries.length)
  })
})
