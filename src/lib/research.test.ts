import { describe, expect, it } from 'vitest'
import { blankBook, type Library } from './model'
import { blankNote } from './notes'
import { blankSermon } from './sermons'
import { blankHymn } from './hymns'
import { booksAbout, materialFor, observationsFor, saveObservation } from './research'

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
  visuals: [],
  notes: [],
  sample: false,
})
const library = (): Library => ({
  ...empty(),
  sermons: [
    { ...blankSermon(), title: 'The Lost Son', scripture: 'Luke 15:11–32' },
    { ...blankSermon(), title: 'Wedding homily', scripture: 'Luke 15:4', occasion: 'Wedding' },
    { ...blankSermon(), title: 'Romans', scripture: 'Romans 8' },
  ],
  notes: [
    { ...blankNote('Illustration'), title: 'Lost coin', scripture: 'Luke 15:8' },
    { ...blankNote('Study note'), title: 'Private', scripture: 'Luke 15:1', personal: true },
  ],
  hymns: [{ ...blankHymn(), title: 'Rejoice', scripture: 'Luke 15:6' }],
  books: [
    { ...blankBook(), title: 'Luke: A Commentary', topics: ['Luke'] },
    { ...blankBook(), title: 'Parables of Luke', topics: [] },
    { ...blankBook(), title: 'Romans', topics: ['commentary'] },
  ],
})

describe('research a text', () => {
  it('gathers what touches the passage and leaves private things out', () => {
    const m = materialFor(library(), 'Luke 15:6–12')
    expect(m.sermons.map((s) => s.title)).toEqual(['The Lost Son'])
    expect(m.notes.map((n) => n.title)).toEqual(['Lost coin'])
    expect(m.hymns.map((h) => h.title)).toEqual(['Rejoice'])
    expect(m.commentaries.map((b) => b.title)).toEqual(['Luke: A Commentary'])
    expect(m.teaching.map((b) => b.title)).toEqual(['Parables of Luke'])
  })
  it('finds nothing for a passage it cannot read', () => {
    expect(materialFor(library(), 'nonsense').sermons).toEqual([])
  })
  it('does not mistake one book name for another', () => {
    const books = [{ ...blankBook(), title: 'Johnny Cash' }]
    expect(booksAbout(books, 'John').teaching).toEqual([])
  })
  it('keeps observations on the passage and updates them in place', () => {
    let lib = saveObservation(
      empty(),
      { kind: 'Study note', title: '', body: 'Shepherd leaves ninety-nine.', sermonId: '' },
      'Luke 15:1–7',
    )
    expect(lib.notes[0].title).toBe('Bible class notes on Luke 15:1–7')
    expect(observationsFor(lib, 'Luke 15:4')).toHaveLength(1)
    expect(observationsFor(lib, 'John 3')).toHaveLength(0)
    lib = saveObservation(
      lib,
      { id: lib.notes[0].id, kind: 'Sermon note', title: 'Lost', body: 'Rejoice.', sermonId: '' },
      'Luke 15:1–7',
    )
    expect(lib.notes).toHaveLength(1)
    expect(lib.notes[0].kind).toBe('Sermon note')
  })
  it('refuses an empty note or an unknown passage', () => {
    const d = { kind: 'Sermon note' as const, title: '', body: '', sermonId: '' }
    expect(() => saveObservation(empty(), d, 'Luke 15')).toThrow()
    expect(() => saveObservation(empty(), { ...d, body: 'x' }, 'nonsense')).toThrow()
  })
})
