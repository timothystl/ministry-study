import { parseBackup } from './storage'
import type { Library } from './model'

// The shared database stores one row per catalog item. These pure helpers turn the library into
// rows, work out what changed since the last save, and rebuild a library from rows.
export interface SyncRecord {
  kind: string
  id: string
  data: string
}
export type Hashes = Record<string, string>
export const CHUNK = 200
export const recordKey = (r: { kind: string; id: string }) => `${r.kind}:${r.id}`

export function hashText(text: string) {
  let a = 0xdeadbeef,
    b = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    a = Math.imul(a ^ c, 2654435761)
    b = Math.imul(b ^ c, 1597334677)
  }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909)
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909)
  return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36) + text.length.toString(36)
}
const isSample = (id: string) => id.startsWith('sample-')
// Illustrative sample books (and any loans on them) are never sent to the shared database.
export function libraryToRecords(library: Library): SyncRecord[] {
  const make = (kind: string, items: { id: string }[]) =>
    items.map((item) => ({ kind, id: item.id, data: JSON.stringify(item) }))
  return [
    ...make(
      'book',
      library.books.filter((b) => !isSample(b.id)),
    ),
    ...make('series', library.series),
    ...make('sermon', library.sermons),
    ...make(
      'loan',
      library.loans.filter((l) => !isSample(l.bookId)),
    ),
  ]
}
export function hashRecords(records: SyncRecord[]): Hashes {
  return Object.fromEntries(records.map((r) => [recordKey(r), hashText(r.data)]))
}
export function diffRecords(records: SyncRecord[], synced: Hashes) {
  const upserts = records.filter((r) => synced[recordKey(r)] !== hashText(r.data))
  const present = new Set(records.map(recordKey))
  const deletes = Object.keys(synced)
    .filter((key) => !present.has(key))
    .map((key) => {
      const at = key.indexOf(':')
      return { kind: key.slice(0, at), id: key.slice(at + 1) }
    })
  return { upserts, deletes }
}
export function recordsToLibrary(records: SyncRecord[]): Library {
  const of = (kind: string) => records.filter((r) => r.kind === kind).map((r) => JSON.parse(r.data))
  return parseBackup({
    version: 1,
    books: of('book'),
    series: of('series'),
    loans: of('loan'),
    sermons: of('sermon'),
    sample: false,
  })
}
// Split a change list into requests the server accepts, keeping upserts before deletes.
export function chunkChanges(change: ReturnType<typeof diffRecords>, size = CHUNK) {
  const ops = [
    ...change.upserts.map((upsert) => ({ upsert })),
    ...change.deletes.map((del) => ({ del })),
  ]
  const chunks: { upserts: SyncRecord[]; deletes: { kind: string; id: string }[] }[] = []
  for (let i = 0; i < ops.length; i += size) {
    const part = ops.slice(i, i + size)
    chunks.push({
      upserts: part.flatMap((o) => ('upsert' in o ? [o.upsert] : [])),
      deletes: part.flatMap((o) => ('del' in o ? [o.del] : [])),
    })
  }
  return chunks
}
