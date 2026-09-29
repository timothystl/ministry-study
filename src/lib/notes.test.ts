import { describe, expect, it } from 'vitest'
import type { Library } from './model'
import {
  blankNote,
  childrenKinds,
  devotionKinds,
  isChildrensKind,
  noteKinds,
  deleteNote,
  noteFromFile,
  notesForSermon,
  saveNote,
  searchNotes,
  MAX_NOTE,
  type Note,
} from './notes'
import { blankSermon } from './sermons'

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
  notes: [],
  sample: false,
})
const note = (over: Partial<Note>): Note => ({ ...blankNote(), title: 'T', body: 'text', ...over })

describe('devotions and notes', () => {
  it('saves, edits, titles an untitled note from its first line, and deletes', () => {
    let lib = saveNote(
      empty(),
      note({
        id: 'a',
        title: '  Council devotion ',
        body: '  Peace be with you.  ',
        tags: [' advent ', ''],
      }),
    )
    expect(lib.notes[0]).toMatchObject({
      title: 'Council devotion',
      body: 'Peace be with you.',
      tags: ['advent'],
    })
    lib = saveNote(lib, { ...lib.notes[0], body: 'Changed.' })
    expect(lib.notes).toHaveLength(1)
    lib = saveNote(lib, note({ id: 'b', title: '', body: 'First line here\nsecond line' }))
    expect(lib.notes[1].title).toBe('First line here')
    expect(deleteNote(lib, 'a').notes.map((n) => n.id)).toEqual(['b'])
  })
  it('rejects empty, oversized and badly dated notes', () => {
    expect(() => saveNote(empty(), note({ title: '', body: ' ' }))).toThrow(/title or some text/)
    expect(() => saveNote(empty(), note({ body: 'x'.repeat(MAX_NOTE + 1) }))).toThrow(/Manuscripts/)
    expect(() => saveNote(empty(), note({ date: 'Advent' }))).toThrow(/valid date/)
  })
})

describe('finding notes', () => {
  const list = [
    note({
      id: 'a',
      title: 'Waiting well',
      body: 'Advent is a season of waiting.',
      scripture: 'Isaiah 64:1–9',
      kind: 'Devotion',
      date: '2024-12-01',
    }),
    note({
      id: 'b',
      title: 'A lantern',
      body: 'An illustration about a lantern in the dark.',
      kind: 'Illustration',
      date: '2023-01-01',
    }),
    note({
      id: 'c',
      title: 'Prodigal ideas',
      body: 'The father runs.',
      scripture: 'Luke 15:11–32',
      kind: 'Sermon note',
      date: '2025-03-01',
    }),
  ]
  const ids = (q: string, kind = '') => searchNotes(list, q, kind).map((h) => h.note.id)
  it('searches words and passages, newest first, and explains each result', () => {
    expect(ids('')).toEqual(['c', 'a', 'b'])
    expect(ids('lantern dark')).toEqual(['b'])
    expect(ids('Luke 15')).toEqual(['c'])
    expect(ids('Isa 64:3')).toEqual(['a'])
    expect(searchNotes(list, 'Luke 15')[0].reasons).toContain('Passage')
    expect(searchNotes(list, 'lantern')[0].reasons).toEqual(['Text'])
    expect(ids('', 'Illustration')).toEqual(['b'])
    expect(ids('waiting', 'Illustration')).toEqual([])
  })
  it('finds the notes tied to a sermon and others on its passage', () => {
    const sermon = { ...blankSermon(), id: 's1', scripture: 'Luke 15:1–10' }
    const library = {
      ...empty(),
      notes: [
        ...list,
        note({ id: 'd', title: 'Tied', sermonId: 's1', scripture: 'John 3' }),
        note({ id: 'e', title: 'Same chapter', scripture: 'Luke 15' }),
      ],
    }
    const found = notesForSermon(library, sermon)
    expect(found.linked.map((n) => n.id)).toEqual(['d'])
    // Luke 15:11–32 does not overlap Luke 15:1–10; a note on the whole chapter does.
    expect(found.onPassage.map((n) => n.id)).toEqual(['e'])
  })
  it('turns a file into a note, reading a date and passage from the name', () => {
    const n = noteFromFile('Body text.', '2025-12-03 Isa 64 Waiting.docx', 'Devotion')
    expect(n).toMatchObject({
      title: 'Waiting',
      date: '2025-12-03',
      scripture: 'Isa 64',
      kind: 'Devotion',
      body: 'Body text.',
    })
  })
})

describe('children’s messages', () => {
  it('are notes of their own kinds, kept apart from devotions', () => {
    expect(isChildrensKind("Children's message")).toBe(true)
    expect(isChildrensKind('Chapel message')).toBe(true)
    expect(isChildrensKind('Devotion')).toBe(false)
    expect(blankNote(childrenKinds[1]).kind).toBe('Chapel message')
    expect(noteKinds).toEqual([...devotionKinds, ...childrenKinds])
  })
})
