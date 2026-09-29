import type { Library } from './model'
import { formatReferences, parseReferences, referencesOverlap } from './scripture'
import { splitCsv } from './sermons'

// Hymns and the liturgies that hold them together. A hymn record keeps the facts (composer,
// lyricist, meter, key, passages, usage), where the music lives (Finale files, sheet music,
// slides) and links to where it is found online. Lyrics are kept only when you type them in.
export const fileKinds = [
  'Finale',
  'Sheet music',
  'Lead sheet',
  'Slides',
  'Order of service',
  'Audio',
  'Text',
  'Other',
] as const
export type FileKind = (typeof fileKinds)[number]
export interface HymnFile {
  kind: FileKind
  location: string // a web address, or a path in your files
}
export interface HymnLink {
  label: string
  url: string
}
export interface Hymn {
  id: string
  title: string
  firstLine: string
  tune: string
  composer: string
  lyricist: string
  arranger: string
  meter: string
  scripture: string
  year: string
  key: string
  hymnal: string // e.g. "LSB 656; RUF Hymnbook"
  usage: string[] // seasons and parts of the service
  themes: string[]
  text: string
  copyright: string
  links: HymnLink[]
  files: HymnFile[]
  notes: string
  source: string
  sourceId: string
  updatedAt: string
}
export const MAX_HYMN_TEXT = 20_000
export const blankHymn = (): Hymn => ({
  id: crypto.randomUUID(),
  title: '',
  firstLine: '',
  tune: '',
  composer: '',
  lyricist: '',
  arranger: '',
  meter: '',
  scripture: '',
  year: '',
  key: '',
  hymnal: '',
  usage: [],
  themes: [],
  text: '',
  copyright: '',
  links: [],
  files: [],
  notes: '',
  source: '',
  sourceId: '',
  updatedAt: '',
})
const isUrl = (v: string) => /^https?:\/\/\S+$/i.test(v.trim())
export const isWebLocation = isUrl
const list = (v: string[]) => v.map((x) => x.trim()).filter(Boolean)
export function saveHymn(library: Library, hymn: Hymn): Library {
  const title = hymn.title.trim()
  if (!title) throw new Error('A hymn needs a title.')
  if (hymn.year && !/^\d{4}$/.test(hymn.year.trim())) throw new Error('Use a four-digit year.')
  if (hymn.text.length > MAX_HYMN_TEXT) throw new Error('The text is too long for a hymn.')
  for (const link of hymn.links)
    if (link.url.trim() && !isUrl(link.url)) throw new Error(`“${link.url}” is not a web address.`)
  const saved: Hymn = {
    ...hymn,
    title,
    year: hymn.year.trim(),
    usage: list(hymn.usage),
    themes: list(hymn.themes),
    links: hymn.links
      .filter((l) => l.url.trim())
      .map((l) => ({ label: l.label.trim() || 'Link', url: l.url.trim() })),
    files: hymn.files
      .filter((f) => f.location.trim())
      .map((f) => ({ ...f, location: f.location.trim() })),
    updatedAt: new Date().toISOString(),
  }
  const exists = library.hymns.some((h) => h.id === hymn.id)
  return {
    ...library,
    hymns: exists
      ? library.hymns.map((h) => (h.id === hymn.id ? saved : h))
      : [...library.hymns, saved],
  }
}
// Removing a hymn also clears it from any liturgy that lists it (the item stays, as its title).
export function deleteHymn(library: Library, id: string): Library {
  const gone = library.hymns.find((h) => h.id === id)
  return {
    ...library,
    hymns: library.hymns.filter((h) => h.id !== id),
    liturgies: library.liturgies.map((l) =>
      l.items.some((i) => i.hymnId === id)
        ? {
            ...l,
            items: l.items.map((i) =>
              i.hymnId === id ? { ...i, hymnId: '', label: i.label || gone?.title || '' } : i,
            ),
            updatedAt: new Date().toISOString(),
          }
        : l,
    ),
  }
}
export const sortHymns = (hymns: Hymn[]) =>
  [...hymns].sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }))

// A search on Hymnary.org (it does not allow lookups from other sites, so this opens its page).
export const hymnarySearchUrl = (title: string) =>
  `https://hymnary.org/search?qu=${encodeURIComponent(title.trim())}`

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
export interface HymnHit {
  hymn: Hymn
  reasons: string[]
}
export interface HymnFilters {
  usage?: string
  hymnal?: string
  hasFiles?: boolean
}
export const allUsage = (hymns: Hymn[]) =>
  [...new Set(hymns.flatMap((h) => h.usage))].sort((a, b) => a.localeCompare(b))
export function searchHymns(hymns: Hymn[], query: string, filters: HymnFilters = {}): HymnHit[] {
  const pool = sortHymns(hymns).filter(
    (h) =>
      (!filters.usage || h.usage.includes(filters.usage)) &&
      (!filters.hymnal || normalize(h.hymnal).includes(normalize(filters.hymnal))) &&
      (!filters.hasFiles || h.files.length > 0),
  )
  const q = normalize(query)
  if (!q) return pool.map((hymn) => ({ hymn, reasons: [] }))
  const parsed = parseReferences(query)
  const words = q.split(' ')
  const hits: HymnHit[] = []
  for (const hymn of pool) {
    const reasons: string[] = []
    if (parsed.complete && referencesOverlap(parsed.refs, parseReferences(hymn.scripture).refs))
      reasons.push('Passage')
    const fields: [string, string][] = [
      ['Title', hymn.title],
      ['First line', hymn.firstLine],
      ['Tune', hymn.tune],
      ['Composer', hymn.composer],
      ['Lyricist', `${hymn.lyricist} ${hymn.arranger}`],
      ['Meter', hymn.meter],
      ['Hymnal', hymn.hymnal],
      ['Theme', `${hymn.themes.join(' ')} ${hymn.usage.join(' ')}`],
      ['Words', hymn.text],
    ]
    for (const [label, value] of fields) {
      const n = normalize(value)
      if (n && words.every((w) => n.includes(w))) reasons.push(label)
    }
    if (reasons.length) hits.push({ hymn, reasons: [...new Set(reasons)] })
  }
  return hits
}

// Files are identified by their extension.
export function fileKindFor(name: string): FileKind {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() || ''
  if (['mus', 'musx', 'mxl', 'etf', 'mscz', 'sib', 'xml', 'musicxml'].includes(ext)) return 'Finale'
  if (['pptx', 'ppt', 'key', 'odp'].includes(ext)) return 'Slides'
  if (['mp3', 'm4a', 'wav', 'aif', 'aiff'].includes(ext)) return 'Audio'
  if (['pdf'].includes(ext)) return 'Sheet music'
  if (['docx', 'doc', 'txt', 'rtf', 'md'].includes(ext)) return 'Text'
  return 'Other'
}
const stem = (name: string) =>
  name
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[a-z0-9]+$/i, '')
// A file's name, without a leading number ("012 Abide With Me", "H012_Abide_With_Me") or "-final".
export const titleFromFileName = (name: string) =>
  stem(name)
    .replace(/[_]+/g, ' ')
    .replace(/^[A-Za-z]{0,2}\d{1,4}[\s._-]+/, '')
    .replace(/[\s._-]+(final|finale|score|slides?|lead sheet|v\d+)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
export interface FilePlan {
  attach: { hymnId: string; title: string; files: HymnFile[] }[]
  create: { title: string; files: HymnFile[] }[]
  already: number
}
// Matches file names to hymns by title. A file that matches nothing becomes a new hymn (named by
// its file name) so it is not lost; files already recorded on a hymn are skipped.
export function planFiles(library: Library, files: { name: string; path: string }[]): FilePlan {
  const byTitle = new Map<string, Hymn>()
  for (const h of library.hymns) {
    byTitle.set(normalize(h.title), h)
    if (h.firstLine) byTitle.set(normalize(h.firstLine), h)
  }
  const attach = new Map<string, FilePlan['attach'][number]>()
  const create = new Map<string, FilePlan['create'][number]>()
  let already = 0
  for (const f of files) {
    const title = titleFromFileName(f.name)
    if (!title) continue
    const entry: HymnFile = { kind: fileKindFor(f.name), location: f.path }
    const key = normalize(title)
    const hymn = byTitle.get(key)
    if (hymn) {
      if (hymn.files.some((x) => normalize(x.location) === normalize(f.path))) {
        already++
        continue
      }
      const cur = attach.get(hymn.id) || { hymnId: hymn.id, title: hymn.title, files: [] }
      cur.files.push(entry)
      attach.set(hymn.id, cur)
    } else {
      const cur = create.get(key) || { title, files: [] }
      cur.files.push(entry)
      create.set(key, cur)
    }
  }
  return { attach: [...attach.values()], create: [...create.values()], already }
}
export function applyFilePlan(library: Library, plan: FilePlan): Library {
  const now = new Date().toISOString()
  const attach = new Map(plan.attach.map((a) => [a.hymnId, a.files]))
  return {
    ...library,
    hymns: [
      ...library.hymns.map((h) =>
        attach.has(h.id) ? { ...h, files: [...h.files, ...attach.get(h.id)!], updatedAt: now } : h,
      ),
      ...plan.create.map((c) => ({
        ...blankHymn(),
        title: c.title,
        files: c.files,
        source: 'Files',
        updatedAt: now,
      })),
    ],
  }
}

// The RUF Hymnbook index (a bundled list of titles, credits and links; the songs stay on their site).
export interface RufEntry {
  id: string
  title: string
  lyricist: string
  composer: string
  arranger: string
  copyright: string
  page: string
  lead: string
  leadCapo: string
  overhead: string
  chords: string
  demo: string
}
export function hymnsFromRuf(
  entries: RufEntry[],
  library: Library,
): { hymns: Hymn[]; skipped: number } {
  const have = new Set(
    library.hymns.filter((h) => h.source === 'RUF Hymnbook').map((h) => h.sourceId),
  )
  const hymns: Hymn[] = []
  let skipped = 0
  const psalm = /^Psalm\s+\d+/i
  for (const e of entries) {
    if (have.has(e.id)) {
      skipped++
      continue
    }
    const links: HymnLink[] = [
      { label: 'RUF Hymnbook page', url: e.page },
      { label: 'Lead sheet', url: e.lead },
      { label: 'Lead sheet (capo key)', url: e.leadCapo },
      { label: 'Overhead lyrics', url: e.overhead },
      { label: 'Chord chart', url: e.chords },
      { label: 'Demo recording', url: e.demo },
    ].filter((l) => l.url)
    hymns.push({
      ...blankHymn(),
      title: e.title,
      lyricist: e.lyricist,
      composer: e.composer,
      arranger: e.arranger,
      scripture: psalm.test(e.title) ? formatReferences(parseReferences(e.title).refs) : '',
      hymnal: 'RUF Hymnbook',
      copyright: e.copyright,
      links,
      source: 'RUF Hymnbook',
      sourceId: e.id,
      updatedAt: new Date().toISOString(),
    })
  }
  return { hymns, skipped }
}

export const HYMN_CSV_HEADERS =
  'Title,First line,Tune,Composer,Lyricist,Meter,Scripture,Year,Key,Hymnal,Usage,Themes,Finale,Sheet music,Slides,Link'
// A spreadsheet of hymns. Recognized columns: Title, First line, Tune, Composer, Lyricist (or
// Author), Meter, Scripture, Year, Key, Hymnal, Usage, Themes, Finale, Sheet music, Slides, Link.
// Usage and Themes are separated by semicolons.
export function parseHymnList(text: string): { hymns: Hymn[]; warnings: string[] } {
  const table = splitCsv(text.replace(/^﻿/, ''))
  const header = table.shift()?.map((h) => normalize(h)) || []
  if (!header.includes('title')) throw new Error('The first row needs a Title column.')
  if (new Set(header).size !== header.length) throw new Error('Column names must be unique.')
  const warnings: string[] = []
  const hymns = table.map((cells, i) => {
    if (cells.length !== header.length)
      throw new Error(`Row ${i + 2} has the wrong number of columns.`)
    const v = (name: string) => (cells[header.indexOf(name)] || '').trim()
    const scripture = v('scripture')
    const parsed = scripture ? parseReferences(scripture) : null
    if (parsed && !parsed.complete) warnings.push(`Row ${i + 2}: passage “${scripture}” not read`)
    const files = (
      [
        ['Finale', v('finale')],
        ['Sheet music', v('sheet music')],
        ['Slides', v('slides')],
      ] as [FileKind, string][]
    )
      .filter(([, loc]) => loc)
      .map(([kind, location]) => ({ kind, location }))
    const link = v('link')
    return {
      ...blankHymn(),
      title: v('title'),
      firstLine: v('first line'),
      tune: v('tune'),
      composer: v('composer'),
      lyricist: v('lyricist') || v('author') || v('words'),
      meter: v('meter'),
      scripture: parsed?.complete ? formatReferences(parsed.refs) : '',
      year: v('year'),
      key: v('key'),
      hymnal: v('hymnal'),
      usage: list(v('usage').split(';')),
      themes: list(v('themes').split(';')),
      files,
      links: link ? [{ label: 'Link', url: link }] : [],
      source: 'Hymn list',
    }
  })
  if (!hymns.length) throw new Error('There is nothing to import.')
  if (hymns.some((h) => !h.title)) throw new Error('Every row needs a title.')
  return { hymns, warnings }
}
// Adds hymns whose title (and composer) are not already in the library.
export function mergeHymns(
  library: Library,
  incoming: Hymn[],
): { library: Library; added: number; skipped: number } {
  const key = (h: Hymn) => `${normalize(h.title)}|${normalize(h.composer)}`
  const seen = new Set(library.hymns.map(key))
  const add: Hymn[] = []
  for (const h of incoming) {
    if (seen.has(key(h))) continue
    seen.add(key(h))
    add.push({
      ...h,
      usage: list(h.usage),
      themes: list(h.themes),
      updatedAt: new Date().toISOString(),
    })
  }
  return {
    library: { ...library, hymns: [...library.hymns, ...add] },
    added: add.length,
    skipped: incoming.length - add.length,
  }
}

// ---- Liturgies -------------------------------------------------------------------------------
export const liturgyKinds = ['Sunday service', 'Season', 'Occasion', 'Other'] as const
export const itemKinds = ['Hymn', 'Reading', 'Prayer', 'Liturgy text', 'Note'] as const
export interface LiturgyItem {
  id: string
  kind: (typeof itemKinds)[number]
  label: string // what it is called in the service ("Gathering hymn", "Kyrie")
  hymnId: string // for a Hymn
  scripture: string
  text: string
}
export interface Liturgy {
  id: string
  title: string
  kind: (typeof liturgyKinds)[number]
  season: string
  date: string
  items: LiturgyItem[]
  files: HymnFile[]
  notes: string
  source: string
  updatedAt: string
}
export const blankItem = (kind: LiturgyItem['kind'] = 'Hymn'): LiturgyItem => ({
  id: crypto.randomUUID(),
  kind,
  label: '',
  hymnId: '',
  scripture: '',
  text: '',
})
export const blankLiturgy = (): Liturgy => ({
  id: crypto.randomUUID(),
  title: '',
  kind: 'Sunday service',
  season: '',
  date: '',
  items: [],
  files: [],
  notes: '',
  source: '',
  updatedAt: '',
})
export function saveLiturgy(library: Library, liturgy: Liturgy): Library {
  const title = liturgy.title.trim()
  if (!title) throw new Error('A liturgy needs a title.')
  if (liturgy.date && !/^\d{4}-\d{2}-\d{2}$/.test(liturgy.date))
    throw new Error('Use a valid date.')
  const saved: Liturgy = {
    ...liturgy,
    title,
    files: liturgy.files
      .filter((f) => f.location.trim())
      .map((f) => ({ ...f, location: f.location.trim() })),
    updatedAt: new Date().toISOString(),
  }
  const exists = library.liturgies.some((l) => l.id === liturgy.id)
  return {
    ...library,
    liturgies: exists
      ? library.liturgies.map((l) => (l.id === liturgy.id ? saved : l))
      : [...library.liturgies, saved],
  }
}
export const deleteLiturgy = (library: Library, id: string): Library => ({
  ...library,
  liturgies: library.liturgies.filter((l) => l.id !== id),
})
export const sortLiturgies = (items: Liturgy[]) =>
  [...items].sort(
    (a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title),
  )
export function moveItem(items: LiturgyItem[], index: number, by: -1 | 1): LiturgyItem[] {
  const to = index + by
  if (to < 0 || to >= items.length) return items
  const next = [...items]
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}
export const liturgiesForHymn = (library: Library, hymnId: string) =>
  sortLiturgies(library.liturgies.filter((l) => l.items.some((i) => i.hymnId === hymnId)))
export function searchLiturgies(liturgies: Liturgy[], hymns: Hymn[], query: string): Liturgy[] {
  const q = normalize(query)
  const pool = sortLiturgies(liturgies)
  if (!q) return pool
  const title = new Map(hymns.map((h) => [h.id, h.title]))
  const words = q.split(' ')
  return pool.filter((l) => {
    const text = normalize(
      [
        l.title,
        l.kind,
        l.season,
        l.notes,
        ...l.items.map((i) => `${i.label} ${i.text} ${i.scripture} ${title.get(i.hymnId) || ''}`),
      ].join(' '),
    )
    return words.every((w) => text.includes(w))
  })
}
