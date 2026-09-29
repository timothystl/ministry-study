// Published book descriptions, from Open Library or Google Books. A description is the publisher's
// or library's own text, so it is always saved with its source and never replaces a summary the
// user wrote without being asked.
export interface PublishedSummary {
  text: string
  source: string
  url: string
}
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
const text = (v: unknown) => (typeof v === 'string' ? v : '')
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
}
export const MAX_SUMMARY = 2000
export function cleanSummary(input: string): string {
  let out = input
    .split(/\n-{5,}/)[0] // Open Library appends "-------- Contains: ..." source lists
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? '')
    .replace(/\(\[source\]\[\d+\]\)/gi, '')
    .replace(/^\[\d+\]:\s*\S+.*$/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_]{1,2}([^*_\n]+)[*_]{1,2}/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (out.length > MAX_SUMMARY) {
    const cut = out.slice(0, MAX_SUMMARY)
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'))
    out = (end > MAX_SUMMARY / 2 ? cut.slice(0, end + 1) : cut.trimEnd() + '…').trim()
  }
  return out
}
// Open Library's "description" is a string or {type, value}.
export function openLibrarySummary(value: unknown, url: string): PublishedSummary | null {
  const d = record(value).description
  const raw = typeof d === 'string' ? d : text(record(d).value)
  const cleaned = cleanSummary(raw)
  return cleaned ? { text: cleaned, source: 'Open Library', url } : null
}
export interface GoogleVolume {
  title: string
  subtitle: string
  authors: string
  publisher: string
  year: string
  coverUrl: string
  summary: PublishedSummary | null
}
export function googleBooksVolume(value: unknown): GoogleVolume | null {
  const items = record(value).items
  const item = Array.isArray(items) ? record(items[0]) : {}
  const info = record(item.volumeInfo)
  if (!text(info.title)) return null
  const id = text(item.id)
  const image = text(record(info.imageLinks).thumbnail)
  const summary = cleanSummary(text(info.description))
  const url = id ? `https://books.google.com/books?id=${encodeURIComponent(id)}` : ''
  return {
    title: text(info.title),
    subtitle: text(info.subtitle),
    authors: strings(info.authors).join('; '),
    publisher: text(info.publisher),
    year: /^\d{4}/.exec(text(info.publishedDate))?.[0] || '',
    coverUrl: image ? image.replace(/^http:/, 'https:').replace('&edge=curl', '') : '',
    summary: summary ? { text: summary, source: 'Google Books', url } : null,
  }
}
