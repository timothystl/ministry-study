import type { Library } from './model'
import { sizeLabel } from './attachments'

// How the shared library's space is used: files by kind, the text of the catalog and manuscripts,
// and the biggest files with the record each belongs to, so it is clear where to cut back.
export interface Usage {
  files: { id: string; name: string; mime: string; size: number }[]
  filesTruncated: boolean
  records: { count: number; bytes: number }
  manuscripts: { count: number; bytes: number }
}
export const fileKinds = ['Images', 'Documents', 'Music & audio', 'Video'] as const
export type FileKind = (typeof fileKinds)[number]
const AUDIO = /\.(mp3|wav|m4a|mid|midi)$/i
const MUSIC = /\.(musx|mus|mxl|etf|mscz|sib)$/i
export function fileKind(f: { name: string; mime: string }): FileKind {
  if (f.mime.startsWith('image/')) return 'Images'
  if (f.mime.startsWith('video/')) return 'Video'
  if (f.mime.startsWith('audio/') || AUDIO.test(f.name) || MUSIC.test(f.name))
    return 'Music & audio'
  return 'Documents'
}
export interface Row {
  kind: FileKind
  count: number
  bytes: number
}
export function summarize(usage: Usage) {
  const rows: Row[] = fileKinds.map((kind) => ({ kind, count: 0, bytes: 0 }))
  for (const f of usage.files) {
    const row = rows.find((r) => r.kind === fileKind(f))!
    row.count += 1
    row.bytes += f.size
  }
  const fileBytes = rows.reduce((n, r) => n + r.bytes, 0)
  const textBytes = usage.records.bytes + usage.manuscripts.bytes
  return { rows, fileBytes, textBytes, total: fileBytes + textBytes }
}
// The record that holds a file, for a plain label such as “Hymn: Abide With Me”.
export function ownerOf(library: Library, id: string): string {
  const has = (list: { id: string }[] | undefined) => !!list?.some((a) => a.id === id)
  for (const h of library.hymns) if (has(h.attachments)) return `Hymn: ${h.title}`
  for (const s of library.sermons) if (has(s.attachments)) return `Sermon: ${s.title}`
  for (const n of library.notes) if (has(n.attachments)) return `${n.kind}: ${n.title}`
  for (const r of library.resources) if (has(r.attachments)) return `Resource: ${r.title}`
  for (const l of library.liturgies)
    if (has(l.attachments) || l.items.some((i) => has(i.attachments))) return `Liturgy: ${l.title}`
  return 'Not attached to anything'
}
export const biggest = (usage: Usage, library: Library, n = 10) =>
  usage.files.slice(0, n).map((f) => ({ ...f, owner: ownerOf(library, f.id) }))
export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`
// “12 documents · 340 images · 3 music & audio files · 0 videos”, in the order the pastor asked for.
export function summaryLine(rows: Row[]): string {
  const of = (kind: FileKind) => rows.find((r) => r.kind === kind)!.count
  return [
    plural(of('Documents'), 'document'),
    plural(of('Images'), 'image'),
    plural(of('Video'), 'video'),
    plural(of('Music & audio'), 'music or audio file'),
  ].join(' · ')
}
export const bytesLabel = sizeLabel

export async function loadUsage(): Promise<Usage> {
  const response = await fetch('/api/usage', { credentials: 'same-origin' })
  if (!response.ok) throw new Error('The shared library could not be reached.')
  return (await response.json()) as Usage
}
