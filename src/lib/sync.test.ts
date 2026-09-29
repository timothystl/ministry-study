import { describe, expect, it } from 'vitest'
import { sampleLibrary } from './seed'
import { parseBackup } from './storage'
import { chunkChanges, diffRecords, hashRecords, libraryToRecords, recordsToLibrary } from './sync'

describe('sync helpers', () => {
  it('round-trips a library through records', () => {
    const library = { ...sampleLibrary(), sample: false }
    const rebuilt = recordsToLibrary(libraryToRecords(library))
    const expected = parseBackup(library)
    expect(rebuilt.books).toEqual(expected.books)
    expect(rebuilt.loans).toEqual(expected.loans)
  })
  it('finds only changed and removed records', () => {
    const library = sampleLibrary()
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
