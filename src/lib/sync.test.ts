import { describe, expect, it } from 'vitest'
import { sampleLibrary } from './seed'
import type { Library } from './model'
import { parseBackup } from './storage'
import { blankSermon } from './sermons'
import { chunkChanges, diffRecords, hashRecords, libraryToRecords, recordsToLibrary } from './sync'

// The sample books renamed as real records, since samples are deliberately never saved.
const realLibrary = (): Library => {
  const library = sampleLibrary()
  return {
    ...library,
    sample: false,
    books: library.books.map((b) => ({ ...b, id: b.id.replace('sample-', 'book-') })),
  }
}
describe('sync helpers', () => {
  it('carries sermons through the shared database and back', () => {
    const library = {
      ...realLibrary(),
      sermons: [{ ...blankSermon(), id: 's1', title: 'The Lost Son' }],
    }
    const records = libraryToRecords(library)
    expect(records.filter((r) => r.kind === 'sermon')).toHaveLength(1)
    expect(recordsToLibrary(records).sermons[0].title).toBe('The Lost Son')
  })
  it('never sends illustrative sample books', () => {
    expect(libraryToRecords(sampleLibrary())).toEqual([])
  })
  it('round-trips a library through records', () => {
    const library = realLibrary()
    const rebuilt = recordsToLibrary(libraryToRecords(library))
    const expected = parseBackup(library)
    expect(rebuilt.books).toEqual(expected.books)
    expect(rebuilt.loans).toEqual(expected.loans)
  })
  it('finds only changed and removed records', () => {
    const library = realLibrary()
    const synced = hashRecords(libraryToRecords(library))
    expect(diffRecords(libraryToRecords(library), synced)).toEqual({ upserts: [], deletes: [] })
    const edited = { ...library, books: library.books.slice(1) }
    edited.books[0] = { ...edited.books[0], title: 'Edited title' }
    const change = diffRecords(libraryToRecords(edited), synced)
    expect(change.upserts).toHaveLength(1)
    expect(change.deletes).toEqual([{ kind: 'book', id: library.books[0].id }])
  })
  it('keeps ids that contain colons and splits large changes', () => {
    const records = Array.from({ length: 450 }, (_, i) => ({
      kind: 'book',
      id: `logos:${i}`,
      data: '{}',
    }))
    const change = diffRecords(records, { 'book:logos:old': 'x' })
    expect(change.deletes).toEqual([{ kind: 'book', id: 'logos:old' }])
    const chunks = chunkChanges(change)
    expect(chunks.map((c) => c.upserts.length + c.deletes.length)).toEqual([200, 200, 51])
  })
  it('refuses to rebuild an inconsistent library', () => {
    expect(() =>
      recordsToLibrary([
        {
          kind: 'loan',
          id: 'l',
          data: JSON.stringify({ id: 'l', bookId: 'gone', loanedAt: '2026-01-01', returnedAt: '' }),
        },
      ]),
    ).toThrow()
  })
})

describe('sharing only the parts a person may use', () => {
  it('leaves out records of parts that are switched off', () => {
    const library = {
      ...realLibrary(),
      sermons: [{ ...blankSermon(), id: 's1', title: 'The Lost Son' }],
    }
    const kinds = (only: string[] | null) => [
      ...new Set(libraryToRecords(library, only).map((r) => r.kind)),
    ]
    expect(kinds(null).sort()).toEqual(['book', 'sermon'])
    expect(kinds(['sermon'])).toEqual(['sermon'])
    expect(kinds(['book', 'series', 'loan'])).toEqual(['book'])
    expect(kinds([])).toEqual([])
  })
})
