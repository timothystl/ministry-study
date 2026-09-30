import { describe, expect, it } from 'vitest'
import {
  applyFilePlan,
  copyLiturgy,
  liturgyToText,
  blankHymn,
  blankItem,
  blankLiturgy,
  deleteHymn,
  fileKindFor,
  hymnarySearchUrl,
  hymnsFromRuf,
  liturgiesForHymn,
  mergeHymns,
  moveItem,
  parseHymnList,
  planFiles,
  saveHymn,
  saveLiturgy,
  searchHymns,
  searchLiturgies,
  titleFromFileName,
  type Hymn,
  type RufEntry,
} from './hymns'
import { attachmentRefs } from './attachments'
import type { Library } from './model'
import rufIndex from '../../public/data/ruf-hymnbook.json?raw'

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
  sample: false,
})
const hymn = (over: Partial<Hymn>): Hymn => ({ ...blankHymn(), title: 'Untitled', ...over })

describe('hymn catalog', () => {
  it('saves, validates and edits in place', () => {
    const h = hymn({ id: 'a', title: '  Abide With Me ', year: '1847', usage: [' Evening ', ''] })
    let lib = saveHymn(empty(), h)
    expect(lib.hymns[0]).toMatchObject({ title: 'Abide With Me', usage: ['Evening'] })
    lib = saveHymn(lib, { ...h, title: 'Abide with me' })
    expect(lib.hymns).toHaveLength(1)
    expect(() => saveHymn(lib, hymn({ title: '' }))).toThrow(/title/)
    expect(() => saveHymn(lib, hymn({ year: '18' }))).toThrow(/year/)
    expect(() => saveHymn(lib, hymn({ links: [{ label: 'x', url: 'nope' }] }))).toThrow(
      /web address/,
    )
  })
  it('finds hymns by words, composer, theme and passage, saying why', () => {
    const lib = {
      ...empty(),
      hymns: [
        hymn({
          id: '1',
          title: 'A Mighty Fortress',
          composer: 'Martin Luther',
          scripture: 'Psalm 46',
          themes: ['Reformation'],
        }),
        hymn({
          id: '2',
          title: 'Abide With Me',
          lyricist: 'Henry Lyte',
          files: [{ kind: 'Finale', location: 'x.musx' }],
        }),
      ],
    }
    expect(searchHymns(lib.hymns, 'luther').map((h) => h.hymn.id)).toEqual(['1'])
    expect(searchHymns(lib.hymns, 'reformation')[0].reasons).toContain('Theme')
    expect(searchHymns(lib.hymns, 'Psalm 46:1')[0].reasons).toContain('Passage')
    expect(searchHymns(lib.hymns, '', { hasFiles: true }).map((h) => h.hymn.id)).toEqual(['2'])
  })
  it('links to a Hymnary search, since Hymnary cannot be queried from here', () => {
    expect(hymnarySearchUrl('A Mighty Fortress')).toBe(
      'https://hymnary.org/search?qu=A%20Mighty%20Fortress',
    )
  })
})

describe('files', () => {
  it('names the kind of file from its extension', () => {
    expect(fileKindFor('Abide.musx')).toBe('Finale')
    expect(fileKindFor('Abide.MUS')).toBe('Finale')
    expect(fileKindFor('Advent.pptx')).toBe('Slides')
    expect(fileKindFor('Abide.pdf')).toBe('Sheet music')
    expect(fileKindFor('Abide.mp3')).toBe('Audio')
  })
  it('reads a hymn title from a file name', () => {
    expect(titleFromFileName('012 Abide With Me.musx')).toBe('Abide With Me')
    expect(titleFromFileName('H012_Abide_With_Me_final.pdf')).toBe('Abide With Me')
    expect(titleFromFileName('Hymns/Abide With Me.pptx')).toBe('Abide With Me')
  })
  it('attaches files to matching hymns and turns the rest into new ones', () => {
    const lib = saveHymn(empty(), hymn({ id: 'a', title: 'Abide With Me' }))
    const plan = planFiles(lib, [
      { name: '012 Abide With Me.musx', path: 'Hymns/012 Abide With Me.musx' },
      { name: 'Abide With Me.pptx', path: 'Hymns/Abide With Me.pptx' },
      { name: 'Be Thou My Vision.musx', path: 'Hymns/Be Thou My Vision.musx' },
    ])
    expect(plan.attach[0].files.map((f) => f.kind)).toEqual(['Finale', 'Slides'])
    expect(plan.create.map((c) => c.title)).toEqual(['Be Thou My Vision'])
    const done = applyFilePlan(lib, plan)
    expect(done.hymns).toHaveLength(2)
    expect(done.hymns[0].files).toHaveLength(2)
    expect(
      planFiles(done, [{ name: 'Abide With Me.pptx', path: 'Hymns/Abide With Me.pptx' }]).already,
    ).toBe(1)
  })
})

describe('imports', () => {
  it('reads a hymn spreadsheet, skips repeats, and reports passages it cannot read', () => {
    const csv =
      'Title,Composer,Scripture,Usage,Finale,Slides\n' +
      'Abide With Me,William Monk,Luke 24:29,Evening; Funeral,Hymns/abide.musx,Hymns/abide.pptx\n' +
      'Bad passage,,Not a verse,,,\n'
    const { hymns, warnings } = parseHymnList(csv)
    expect(hymns[0]).toMatchObject({ scripture: 'Luke 24:29', usage: ['Evening', 'Funeral'] })
    expect(hymns[0].files.map((f) => f.kind)).toEqual(['Finale', 'Slides'])
    expect(warnings[0]).toMatch(/not read/)
    const first = mergeHymns(empty(), hymns)
    expect(first.added).toBe(2)
    expect(mergeHymns(first.library, hymns).added).toBe(0)
    expect(() => parseHymnList('Name\nx')).toThrow(/Title/)
  })
  it('brings in the bundled RUF Hymnbook index once', () => {
    const entries = JSON.parse(rufIndex) as RufEntry[]
    expect(entries.length).toBeGreaterThan(150)
    const { hymns } = hymnsFromRuf(entries, empty())
    expect(hymns).toHaveLength(entries.length)
    const fortress = hymns.find((h) => h.title === 'A Mighty Fortress Is Our God')!
    expect(fortress).toMatchObject({ lyricist: 'Martin Luther', hymnal: 'RUF Hymnbook' })
    expect(fortress.links.map((l) => l.label)).toContain('Lead sheet')
    expect(hymnsFromRuf(entries, { ...empty(), hymns }).skipped).toBe(entries.length)
    expect(hymns.every((h) => h.text === '')).toBe(true)
    expect(hymns[0].id).toBe(`ruf-${entries[0].id}`) // fixed ids: two devices cannot duplicate them
  })
})

describe('liturgies', () => {
  const base = () => {
    const lib = saveHymn(
      saveHymn(empty(), hymn({ id: 'h1', title: 'Abide With Me' })),
      hymn({ id: 'h2', title: 'Be Thou My Vision' }),
    )
    return {
      lib,
      item: (hymnId: string, label: string) => ({ ...blankItem('Hymn'), hymnId, label }),
    }
  }
  it('keeps the order, the hymns and the slides together', () => {
    const { lib, item } = base()
    const l = {
      ...blankLiturgy(),
      id: 'l1',
      title: 'Advent evening prayer',
      season: 'Advent',
      items: [item('h1', 'Opening hymn'), item('h2', 'Closing hymn')],
      files: [{ kind: 'Slides' as const, location: 'Liturgy/advent.pptx' }],
    }
    const saved = saveLiturgy(lib, l)
    expect(saved.liturgies[0].items.map((i) => i.label)).toEqual(['Opening hymn', 'Closing hymn'])
    expect(moveItem(l.items, 0, 1).map((i) => i.label)).toEqual(['Closing hymn', 'Opening hymn'])
    expect(moveItem(l.items, 0, -1)).toBe(l.items)
    expect(liturgiesForHymn(saved, 'h2').map((x) => x.id)).toEqual(['l1'])
    expect(searchLiturgies(saved.liturgies, saved.hymns, 'be thou').length).toBe(1)
    expect(searchLiturgies(saved.liturgies, saved.hymns, 'lent').length).toBe(0)
    expect(() => saveLiturgy(lib, { ...blankLiturgy(), title: ' ' })).toThrow(/title/)
  })
  it('keeps a liturgy’s item when its hymn is removed', () => {
    const { lib, item } = base()
    const saved = saveLiturgy(lib, { ...blankLiturgy(), title: 'S', items: [item('h1', '')] })
    const after = deleteHymn(saved, 'h1')
    expect(after.liturgies[0].items[0]).toMatchObject({ hymnId: '', label: 'Abide With Me' })
  })
})

describe('a liturgy held whole', () => {
  const setup = () => {
    let lib = saveHymn(
      empty(),
      hymn({ id: 'h1', title: 'Abide With Me', composer: 'W. H. Monk', hymnal: 'LSB 878' }),
    )
    const kyrie = {
      ...blankItem('Liturgy text'),
      label: 'Kyrie',
      text: 'In peace let us pray to the Lord.\nLord, have mercy.',
      files: [{ kind: 'Finale' as const, location: 'Music/kyrie.musx' }],
      attachments: [
        { id: 'att-kyrie-1', name: 'kyrie.png', mime: 'image/png', size: 10, addedAt: '' },
      ],
    }
    const opening = { ...blankItem('Hymn'), label: 'Opening hymn', hymnId: 'h1' }
    lib = saveLiturgy(lib, {
      ...blankLiturgy(),
      id: 'set1',
      title: 'Divine Service, Setting 3',
      kind: 'Setting',
      items: [opening, kyrie],
    })
    return lib
  }
  it('reads as one text with every part in order', () => {
    const lib = setup()
    const text = liturgyToText(lib, lib.liturgies[0])
    expect(text.split('\n')[0]).toBe('DIVINE SERVICE, SETTING 3')
    expect(text.indexOf('OPENING HYMN')).toBeLessThan(text.indexOf('KYRIE'))
    expect(text).toContain('Abide With Me (LSB 878)')
    expect(text).toContain('Music: W. H. Monk')
    expect(text).toContain('Lord, have mercy.')
  })
  it('starts a new service from a setting, keeping every part and its music', () => {
    const lib = setup()
    const made = copyLiturgy(lib, 'set1')!
    const copy = made.liturgy
    expect(copy).toMatchObject({
      title: 'Divine Service, Setting 3 (copy)',
      kind: 'Sunday service',
      date: '',
    })
    expect(copy.items.map((i) => i.label)).toEqual(['Opening hymn', 'Kyrie'])
    expect(copy.items[0].hymnId).toBe('h1')
    expect(copy.items[1].files).toHaveLength(1)
    expect(copy.items[1].attachments[0].id).toBe('att-kyrie-1')
    // its parts are its own: new ids, so editing one does not touch the original
    expect(copy.id).not.toBe('set1')
    expect(copy.items[1].id).not.toBe(lib.liturgies[0].items[1].id)
    expect(made.library.liturgies).toHaveLength(2)
    expect(copyLiturgy(lib, 'missing')).toBeNull()
  })
  it('counts how many records use each stored file, so shared music is not deleted', () => {
    const lib = copyLiturgy(setup(), 'set1')!.library
    expect(attachmentRefs(lib).get('att-kyrie-1')).toBe(2)
  })
})
