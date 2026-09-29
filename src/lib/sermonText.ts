import { strToU8, unzipSync, zipSync } from 'fflate'
import { fileIndex, type Sermon } from './sermons'

// Full sermon manuscripts live in the shared database, apart from the library, so the library
// stays quick. Word files are read in the browser; only their text is sent.
export interface TextStatus {
  id: string
  chars: number
  hash: string
  indexed: boolean
}
export interface SavedText {
  text: string
  chars: number
  hash: string
  fileName: string
  indexed: boolean
  updatedAt: string
}
export interface TextHit {
  id: string
  snippet: string
}
async function call<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
    if (response.status === 404 && path.startsWith('/api/sermon-text/')) return null
    if (!(response.headers.get('Content-Type') || '').includes('json') || !response.ok)
      throw new Error(
        response.status === 401 || response.status === 503
          ? 'The shared library is not available. Sign in and try again.'
          : 'The shared library could not be reached.',
      )
    return (await response.json()) as T
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('The shared')) throw e
    throw new Error('The shared library could not be reached.')
  }
}
export const textStatus = () => call<TextStatus[]>('/api/sermon-text')
export const getSermonText = (id: string) =>
  call<SavedText>(`/api/sermon-text/${encodeURIComponent(id)}`)
export const putSermonText = (
  id: string,
  body: { text: string; hash: string; fileName: string; indexed: boolean },
) =>
  call<{ ok: boolean }>(`/api/sermon-text/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
export const deleteSermonText = (id: string) =>
  call<{ ok: boolean }>(`/api/sermon-text/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const setSermonIndexed = (id: string, indexed: boolean) =>
  call<{ ok: boolean }>(`/api/sermon-text/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ indexed }),
  })
export const searchSermonText = (query: string) =>
  call<TextHit[]>(`/api/sermon-search?${new URLSearchParams({ q: query })}`)

// ----- Reading files -----
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
}
const unescapeXml = (s: string) =>
  s.replace(/&(?:amp|lt|gt|quot|apos);|&#(\d+);|&#x([0-9a-f]+);/gi, (m, dec, hex) =>
    dec
      ? String.fromCodePoint(+dec)
      : hex
        ? String.fromCodePoint(parseInt(hex, 16))
        : ENTITIES[m.toLowerCase()] || m,
  )
// The text of a Word document, paragraph by paragraph. Text deleted in tracked changes is left out.
export function docxText(data: Uint8Array): string {
  const files = unzipSync(data, { filter: (f) => f.name === 'word/document.xml' })
  const xml = files['word/document.xml']
  if (!xml) throw new Error('This does not look like a Word document.')
  const body = new TextDecoder().decode(xml).replace(/<w:del\b[\s\S]*?<\/w:del>/g, '')
  const paragraphs = [...body.matchAll(/<w:p\b[^>]*?(?:\/>|>([\s\S]*?)<\/w:p>)/g)].map((p) =>
    [
      ...(p[1] || '').matchAll(
        /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>|<w:cr\s*\/>/g,
      ),
    ]
      .map((m) =>
        m[0].startsWith('<w:tab') ? '\t' : m[0].startsWith('<w:t') ? unescapeXml(m[1]) : '\n',
      )
      .join(''),
  )
  return paragraphs
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
export async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
export interface Manuscript {
  text: string
  hash: string
}
export async function readManuscript(file: File): Promise<Manuscript> {
  const name = file.name.toLowerCase()
  if (file.size > 25_000_000) throw new Error('That file is too large.')
  let text: string
  if (name.endsWith('.docx')) text = docxText(new Uint8Array(await file.arrayBuffer()))
  else if (/\.(txt|md)$/.test(name)) text = (await file.text()).replace(/\r\n?/g, '\n').trim()
  else throw new Error('Only Word (.docx), text and Markdown files can be read.')
  if (!text) throw new Error('The file is empty.')
  return { text, hash: await sha256(text) }
}

// ----- Matching files to sermons -----
const base = (path: string) => path.split(/[\\/]/).pop()!.toLowerCase()
const words = (value: string) =>
  value
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,4}$/, '')
    .replace(/^\d{3,5}_/, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
export interface FileMatch {
  file: File
  sermon: Sermon
}
// A file belongs to the sermon whose recorded location ends in that file name. A file with the
// same file number and a title that agrees also matches, for files renamed since the index.
export function matchFiles(files: File[], sermons: Sermon[]) {
  const byName = new Map(sermons.filter((s) => s.manuscript).map((s) => [base(s.manuscript), s]))
  const taken = new Set<string>()
  const matched: FileMatch[] = []
  const unmatched: File[] = []
  const duplicates: File[] = []
  for (const file of files) {
    let sermon = byName.get(file.name.toLowerCase())
    if (!sermon) {
      const number = fileIndex(file.name)
      const tail = words(file.name)
      sermon = number
        ? sermons.find((s) => {
            const title = words(s.title)
            return (
              s.sourceId === number &&
              title.length > 3 &&
              (tail.includes(title) || title.includes(tail))
            )
          })
        : undefined
    }
    if (!sermon) unmatched.push(file)
    else if (taken.has(sermon.id)) duplicates.push(file)
    else {
      taken.add(sermon.id)
      matched.push({ file, sermon })
    }
  }
  return { matched, unmatched, duplicates }
}

// ----- Backup -----
const safeName = (name: string) =>
  name
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'sermon'
// Every saved manuscript, fetched a page at a time.
export async function fetchAllManuscripts(onProgress: (done: number) => void) {
  const all: { id: string; text: string; fileName: string }[] = []
  let after = ''
  for (;;) {
    const page = await call<{ id: string; text: string; fileName: string }[]>(
      `/api/sermon-export?${new URLSearchParams({ after })}`,
    )
    if (!page?.length) return all
    all.push(...page)
    after = page[page.length - 1].id
    onProgress(all.length)
  }
}
export async function buildBackup(
  sermons: Sermon[],
  onProgress: (done: number) => void,
): Promise<Uint8Array> {
  const byId = new Map(sermons.map((s) => [s.id, s]))
  const files: Record<string, Uint8Array> = {}
  const all = await fetchAllManuscripts(onProgress)
  if (!all.length) throw new Error('There are no saved manuscripts to download.')
  for (const item of all) {
    const sermon = byId.get(item.id)
    const stem = safeName(
      (item.fileName || sermon?.title || item.id).replace(/\.[a-z0-9]{2,4}$/i, ''),
    )
    let name = `${stem}.txt`
    for (let n = 2; files[name]; n++) name = `${stem} (${n}).txt`
    files[name] = strToU8(item.text)
  }
  return zipSync(files)
}
export const safeFileName = safeName
export function downloadBlob(
  data: Uint8Array<ArrayBuffer> | Uint8Array,
  name: string,
  type: string,
) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
