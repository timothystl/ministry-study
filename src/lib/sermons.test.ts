import { describe, expect, it } from 'vitest'
import type { Library } from './model'
import {
  blankSermon,
  isWebLink,
  parseSermonLine,
  parseSermonList,
  previewSermonImport,
  samePassage,
  saveSermon,
  searchSermons,
  type Sermon,
} from './sermons'

const empty = (): Library => ({
  version: 1,
  books: [],
  series: [],
  loans: [],
  sermons: [],
  prayers: [],
  prayerSets: [],
  sample: false,
})
const sermon = (over: Partial<Sermon>): Sermon => ({ ...blankSermon(), title: 'Untitled', ...over })

describe('sermon catalog', () => {
  it('saves, edits and requires a title', () => {
    const s = sermon({ title: '  The Lost Son ', themes: [' grace ', ''] })
    const saved = saveSermon(empty(), s)
    expect(saved.sermons[0].title).toBe('The Lost Son')
    expect(saved.sermons[0].themes).toEqual(['grace'])
    const edited = saveSermon(saved, { ...saved.sermons[0], title: 'Renamed' })
    expect(edited.sermons).toHaveLength(1)
    expect(() => saveSermon(empty(), sermon({ title: ' ' }))).toThrow()
    expect(() => saveSermon(empty(), sermon({ date: 'March' }))).toThrow()
  })
  it('only treats http(s) addresses as links', () => {
    expect(isWebLink('https://onedrive.live.com/x')).toBe(true)
    expect(isWebLink('javascript:alert(1)')).toBe(false)
    expect(isWebLink('OneDrive/Sermons/x.docx')).toBe(false)
  })
})

describe('sermon search', () => {
  const list = [
    sermon({
      id: 'a',
      title: 'The Lost Son',
      scripture: 'Luke 15:11-32',
      date: '2025-03-16',
      series: 'Lent 2025',
      themes: ['grace', 'home'],
    }),
    sermon({
      id: 'b',
      title: 'Lost and Found',
      scripture: 'Luke 15:1-10',
      date: '2023-09-10',
      summary: 'A shepherd and a woman.',
    }),
    sermon({
      id: 'c',
      title: 'Love',
      scripture: '1 Corinthians 13',
      date: '2024-01-28',
      notes: 'Wedding-adjacent.',
    }),
    sermon({ id: 'd', title: 'No date', scripture: 'Psalm 23' }),
  ]
  const ids = (q: string, f = {}) => searchSermons(list, q, f).map((h) => h.sermon.id)
  it('finds every sermon on an overlapping passage, newest first', () => {
    expect(ids('Luke 15')).toEqual(['a', 'b'])
    expect(ids('Luke 15:5')).toEqual(['b'])
    expect(ids('1 Cor 13:4')).toEqual(['c'])
    expect(ids('Ps 23')).toEqual(['d'])
  })
  it('explains why each result matched', () => {
    const hits = searchSermons(list, 'Luke 15')
    expect(hits[0].reasons).toContain('Passage')
    expect(searchSermons(list, 'grace')[0].reasons[0]).toMatch(/Text in .*themes/)
  })
  it('matches words across fields with AND', () => {
    expect(ids('lost')).toEqual(['a', 'b'])
    expect(ids('lost grace')).toEqual(['a'])
    expect(ids('shepherd')).toEqual(['b'])
    expect(ids('nothing here')).toEqual([])
  })
  it('filters by series and year, and lists undated sermons last', () => {
    expect(ids('', { series: 'Lent 2025' })).toEqual(['a'])
    expect(ids('', { year: '2023' })).toEqual(['b'])
    expect(ids('')).toEqual(['a', 'c', 'b', 'd'])
  })
  it('lists other sermons on the same passage', () => {
    const library = { ...empty(), sermons: list }
    expect(samePassage(library, list[0]).map((s) => s.id)).toEqual([])
    const again = sermon({ id: 'e', title: 'Again', scripture: 'Luke 15' })
    expect(
      samePassage({ ...library, sermons: [...list, again] }, list[0]).map((s) => s.id),
    ).toEqual(['e'])
  })
})

describe('sermon list import', () => {
  it('reads a leading date and a written passage from a file name, nothing more', () => {
    const row = parseSermonLine('2025-03-16 Luke 15 The Lost Son.docx', 'OneDrive/Sermons')
    expect(row).toMatchObject({
      title: 'The Lost Son',
      scripture: 'Luke 15',
      date: '2025-03-16',
      manuscript: 'OneDrive/Sermons/2025-03-16 Luke 15 The Lost Son.docx',
    })
    const plain = parseSermonLine('Advent wreath talk.docx')
    expect(plain).toMatchObject({ title: 'Advent wreath talk', scripture: '', date: '' })
  })
  it('does not guess ambiguous dates', () => {
    expect(parseSermonLine('3-4-25 Easter').date).toBe('')
    expect(parseSermonLine('2025-13-45 Easter').date).toBe('')
    expect(parseSermonLine('03-16-2025 Easter').date).toBe('2025-03-16')
  })
  it('reads a CSV and rejects bad rows', () => {
    const rows = parseSermonList(
      'Title,Scripture,Date,Series\n"Grace, again",John 3,2024-02-04,Lent\n',
    )
    expect(rows[0]).toMatchObject({
      title: 'Grace, again',
      scripture: 'John 3',
      date: '2024-02-04',
      series: 'Lent',
    })
    expect(parseSermonList('Title,Date\nA,Feb 4\n')[0]).toMatchObject({
      date: '',
      warnings: ['date “Feb 4” not read'],
    })
    expect(() => parseSermonList('Title,Date\n,2024-02-04\n')).toThrow(/needs a title/)
  })
  it('skips sermons already in the catalog and never changes existing ones', () => {
    const library = saveSermon(
      empty(),
      sermon({
        title: 'The Lost Son',
        manuscript: 'x/2025-03-16 Luke 15 The Lost Son.docx',
        notes: 'keep me',
      }),
    )
    const rows = parseSermonList(
      '2025-03-16 Luke 15 The Lost Son.docx\n2025-03-23 John 3 Born Again.docx',
      'x',
    )
    const preview = previewSermonImport(rows, library)
    expect(preview.entries.map((e) => e.action)).toEqual(['Already listed', 'Add'])
    expect(preview.library.sermons).toHaveLength(2)
    expect(preview.library.sermons[0].notes).toBe('keep me')
    expect(preview.library.sermons[1].source).toBe('Imported list')
  })
})
