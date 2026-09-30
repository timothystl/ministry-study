import type { Library } from './model'

// Photos and PDFs kept with a record, such as sheet music for a hymn or a scanned hymnal page.
// The files live in the shared library; the record keeps only their names and sizes.
export interface Attachment {
  id: string
  name: string
  mime: string
  size: number
  addedAt: string
}
export const MAX_ATTACHMENT = 8_000_000
const KEEP_AS_IS = 1_500_000 // photos smaller than this are kept exactly as taken
const LONGEST_SIDE = 2200
export const attachmentUrl = (id: string) => `/api/attachments/${id}`
export const isImageAttachment = (a: Pick<Attachment, 'mime'>) => a.mime.startsWith('image/')
export const sizeLabel = (bytes: number) =>
  bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1000))} KB`

// What a chosen file is, judged by its type or, when the browser gives none, its ending.
export function attachmentType(file: Pick<File, 'type' | 'name'>): string {
  const type = file.type.toLowerCase()
  if (['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'].includes(type))
    return type
  if (type.startsWith('image/')) return 'image/other' // HEIC and the like: converted to JPEG
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1].toLowerCase() || ''
  if (!type) {
    if (ext === 'pdf') return 'application/pdf'
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
    if (ext === 'png') return 'image/png'
  }
  // Music, Finale and slide files are kept as downloads.
  if (DOWNLOAD_EXTENSIONS.includes(ext)) return DOWNLOAD_TYPE
  return ''
}
export const DOWNLOAD_TYPE = 'application/octet-stream'
export const DOWNLOAD_EXTENSIONS = [
  'mus',
  'musx',
  'etf',
  'mxl',
  'mscz',
  'sib',
  'pptx',
  'ppt',
  'key',
  'docx',
  'doc',
  'mp3',
  'm4a',
  'wav',
  'mid',
  'midi',
  'txt',
  'md',
  'rtf',
]
export const ACCEPTED_FILES = `image/*,application/pdf,${DOWNLOAD_EXTENSIONS.map((e) => `.${e}`).join(',')}`
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.85, 0.75, 0.65]) {
      const blob = await new Promise<Blob | null>((done) =>
        canvas.toBlob(done, 'image/jpeg', quality),
      )
      if (blob && blob.size <= MAX_ATTACHMENT) return blob
    }
    throw new Error('Could not make that photo small enough.')
  } finally {
    bitmap.close()
  }
}
export async function prepareFile(file: File): Promise<{ blob: Blob; mime: string; name: string }> {
  const type = attachmentType(file)
  if (!type)
    throw new Error(
      `${file.name}: only photos, PDFs, music, slide and Finale files can be attached.`,
    )
  if (type === 'application/pdf' || type === DOWNLOAD_TYPE) {
    if (file.size > MAX_ATTACHMENT) throw new Error(`${file.name}: too large (8 MB at most).`)
    return { blob: file, mime: type, name: file.name }
  }
  if (file.size > 40_000_000) throw new Error(`${file.name}: that photo is too large.`)
  if (type !== 'image/other' && type !== 'image/gif' && file.size <= KEEP_AS_IS)
    return { blob: file, mime: type, name: file.name }
  if (type === 'image/gif') {
    if (file.size > MAX_ATTACHMENT) throw new Error(`${file.name}: too large (8 MB at most).`)
    return { blob: file, mime: type, name: file.name }
  }
  const blob = await shrink(file)
  return { blob, mime: 'image/jpeg', name: file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg' }
}
export async function uploadFile(
  id: string,
  blob: Blob,
  mime: string,
  name: string,
): Promise<string> {
  try {
    const response = await fetch(attachmentUrl(id), {
      method: 'PUT',
      headers: { 'Content-Type': mime, 'X-File-Name': encodeURIComponent(name) },
      body: blob,
      credentials: 'same-origin',
    })
    if (response.ok) return ''
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    return body.error || 'The file could not be saved.'
  } catch {
    return 'Files are kept in the shared library, which cannot be reached right now.'
  }
}
export async function removeFile(id: string): Promise<void> {
  try {
    await fetch(attachmentUrl(id), { method: 'DELETE', credentials: 'same-origin' })
  } catch {
    // The record no longer points at it; an unreachable copy can be cleaned up later.
  }
}
// Adds files to a list: each is prepared, uploaded, and described. Files that fail are reported.
export async function attachFiles(
  files: File[],
): Promise<{ added: Attachment[]; errors: string[] }> {
  const added: Attachment[] = []
  const errors: string[] = []
  for (const file of files) {
    try {
      const { blob, mime, name } = await prepareFile(file)
      const id = crypto.randomUUID()
      const problem = await uploadFile(id, blob, mime, name)
      if (problem) errors.push(`${file.name}: ${problem}`)
      else added.push({ id, name, mime, size: blob.size, addedAt: new Date().toISOString() })
    } catch (e) {
      errors.push((e as Error).message)
    }
  }
  return { added, errors }
}
// How many records point at each stored file. A liturgy started from another shares its files,
// so a file is deleted only when the last record using it lets go.
export function attachmentRefs(library: Library): Map<string, number> {
  const counts = new Map<string, number>()
  const add = (list: Attachment[]) =>
    list.forEach((a) => counts.set(a.id, (counts.get(a.id) || 0) + 1))
  library.hymns.forEach((h) => add(h.attachments))
  library.sermons.forEach((s) => add(s.attachments))
  library.notes.forEach((n) => add(n.attachments))
  library.resources.forEach((r) => add(r.attachments))
  library.liturgies.forEach((l) => {
    add(l.attachments)
    l.items.forEach((i) => add(i.attachments))
  })
  return counts
}
export const usedElsewhere = (refs: Map<string, number>, id: string) => (refs.get(id) || 0) > 1
// Deletes the stored files of a record that is being removed, unless another record still uses them.
export function removeUnused(library: Library, removed: Attachment[]) {
  const refs = attachmentRefs(library)
  removed.forEach((a) => {
    if (!usedElsewhere(refs, a.id)) void removeFile(a.id)
  })
}
