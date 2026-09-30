import type { Attachment } from './attachments'
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
  attachments: Attachment[] // photos and PDFs kept in the shared library
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
  attachments: [],
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
// Files that were uploaded (keyed by their path) are attached as stored files; the others are
// recorded by location only.
export function applyFilePlan(
  library: Library,
  plan: FilePlan,
  uploaded: Map<string, Attachment> = new Map(),
): Library {
  const now = new Date().toISOString()
  const split = (files: HymnFile[]) => ({
    files: files.filter((f) => !uploaded.has(f.location)),
    attachments: files.flatMap((f) => uploaded.get(f.location) ?? []),
  })
  const attach = new Map(plan.attach.map((a) => [a.hymnId, split(a.files)]))
  return {
    ...library,
    hymns: [
      ...library.hymns.map((h) => {
        const add = attach.get(h.id)
        return add
          ? {
              ...h,
              files: [...h.files, ...add.files],
              attachments: [...h.attachments, ...add.attachments],
              updatedAt: now,
            }
          : h
      }),
      ...plan.create.map((c) => ({
        ...blankHymn(),
        title: c.title,
        ...split(c.files),
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
      id: `ruf-${e.id}`,
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
  'Title,First line,Tune,Composer,Lyricist,Meter,Scripture,Year,Key,Hymnal,Number,Usage,Themes,Finale,Sheet music,Slides,Link'
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
      hymnal: [v('hymnal'), v('number') || v('no') || v('hymn number')].filter(Boolean).join(' '),
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
// "LSB 878; TLH 262": each hymnal and number is one entry, kept once.
export function addHymnalRef(existing: string, refs: string): string {
  const parts = existing
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
  for (const ref of refs
    .split(';')
    .map((r) => r.trim())
    .filter(Boolean))
    if (!parts.some((p) => normalize(p) === normalize(ref))) parts.push(ref)
  return parts.join('; ')
}
const agree = (a: string, b: string) => !a.trim() || !b.trim() || normalize(a) === normalize(b)
// Brings hymns in from a list or a hymnal's index. A hymn already in the catalog (same title, and a
// tune that does not disagree; composers are spelled too many ways to compare) is not added again: the new hymnal number is added to it,
// and only blanks are filled in, so nothing you wrote is overwritten.
export function mergeHymns(
  library: Library,
  incoming: Hymn[],
): { library: Library; added: number; updated: number; skipped: number } {
  const hymns = [...library.hymns]
  const fresh = new Set<string>()
  let added = 0
  let updated = 0
  let skipped = 0
  const now = new Date().toISOString()
  for (const h of incoming) {
    const at = hymns.findIndex(
      (x) => normalize(x.title) === normalize(h.title) && agree(x.tune, h.tune),
    )
    if (at < 0) {
      hymns.push({ ...h, usage: list(h.usage), themes: list(h.themes), updatedAt: now })
      fresh.add(h.id)
      added++
      continue
    }
    const x = hymns[at]
    const fill = (a: string, b: string) => (a.trim() ? a : b)
    const merged: Hymn = {
      ...x,
      hymnal: addHymnalRef(x.hymnal, h.hymnal),
      firstLine: fill(x.firstLine, h.firstLine),
      tune: fill(x.tune, h.tune),
      composer: fill(x.composer, h.composer),
      lyricist: fill(x.lyricist, h.lyricist),
      arranger: fill(x.arranger, h.arranger),
      meter: fill(x.meter, h.meter),
      scripture: fill(x.scripture, h.scripture),
      year: fill(x.year, h.year),
      key: fill(x.key, h.key),
      usage: [...new Set([...x.usage, ...list(h.usage)])],
      themes: [...new Set([...x.themes, ...list(h.themes)])],
    }
    const same =
      JSON.stringify({ ...merged, updatedAt: '' }) === JSON.stringify({ ...x, updatedAt: '' })
    if (same) skipped++
    else {
      hymns[at] = { ...merged, updatedAt: now }
      updated++
    }
  }
  return { library: { ...library, hymns }, added, updated, skipped }
}

// ---- Liturgies -------------------------------------------------------------------------------
// A liturgy is held as one whole: every part in order, each with its words, its music and its
// files. A "Setting" is a complete rite kept to be used again (Divine Service, Matins, Evening
// Prayer); a "Sunday service" or "Occasion" is one used on a day, often started from a setting.
export const liturgyKinds = ['Setting', 'Sunday service', 'Season', 'Occasion', 'Other'] as const
export const itemKinds = [
  'Hymn',
  'Reading',
  'Prayer',
  'Liturgy text',
  'Music',
  'Rubric',
  'Note',
] as const
export interface LiturgyItem {
  id: string
  kind: (typeof itemKinds)[number]
  label: string // what it is called in the service ("Gathering hymn", "Kyrie")
  hymnId: string // for a Hymn
  scripture: string
  text: string // the words of this part, in full
  files: HymnFile[] // Finale files, slides for this part
  attachments: Attachment[] // photos and PDFs of its music
}
export interface Liturgy {
  id: string
  title: string
  kind: (typeof liturgyKinds)[number]
  season: string
  date: string
  items: LiturgyItem[]
  files: HymnFile[] // slides or the order of service for the whole
  attachments: Attachment[] // photos and PDFs of the whole
  notes: string
  source: string
  updatedAt: string
}
export const MAX_PART_TEXT = 30_000
export const blankItem = (kind: LiturgyItem['kind'] = 'Hymn'): LiturgyItem => ({
  id: crypto.randomUUID(),
  kind,
  label: '',
  hymnId: '',
  scripture: '',
  text: '',
  files: [],
  attachments: [],
})
export const blankLiturgy = (): Liturgy => ({
  id: crypto.randomUUID(),
  title: '',
  kind: 'Sunday service',
  season: '',
  date: '',
  items: [],
  files: [],
  attachments: [],
  notes: '',
  source: '',
  updatedAt: '',
})
export function saveLiturgy(library: Library, liturgy: Liturgy): Library {
  const title = liturgy.title.trim()
  if (!title) throw new Error('A liturgy needs a title.')
  if (liturgy.date && !/^\d{4}-\d{2}-\d{2}$/.test(liturgy.date))
    throw new Error('Use a valid date.')
  const cleanFiles = (files: HymnFile[]) =>
    files.filter((f) => f.location.trim()).map((f) => ({ ...f, location: f.location.trim() }))
  if (liturgy.items.some((i) => i.text.length > MAX_PART_TEXT))
    throw new Error(`A part is longer than ${MAX_PART_TEXT.toLocaleString()} characters.`)
  const saved: Liturgy = {
    ...liturgy,
    title,
    files: cleanFiles(liturgy.files),
    items: liturgy.items.map((i) => ({ ...i, files: cleanFiles(i.files) })),
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

// A new liturgy started from an existing one (usually a setting): the same parts in the same
// order, with their words, hymns, files and music. The date is left blank. Stored photos and PDFs
// are shared with the original, not copied.
export function copyLiturgy(
  library: Library,
  id: string,
  kind: Liturgy['kind'] = 'Sunday service',
): { library: Library; liturgy: Liturgy } | null {
  const from = library.liturgies.find((l) => l.id === id)
  if (!from) return null
  const liturgy: Liturgy = {
    ...structuredClone(from),
    id: crypto.randomUUID(),
    title: `${from.title} (copy)`,
    kind,
    date: '',
    source: '',
    items: from.items.map((i) => ({ ...structuredClone(i), id: crypto.randomUUID() })),
    updatedAt: new Date().toISOString(),
  }
  return { library: { ...library, liturgies: [...library.liturgies, liturgy] }, liturgy }
}
// The whole liturgy as plain text, every part in order, for copying into a bulletin or a document.
export function liturgyToText(library: Library, liturgy: Liturgy): string {
  const out: string[] = [liturgy.title.toUpperCase()]
  const meta = [liturgy.kind, liturgy.season, liturgy.date].filter(Boolean).join(' · ')
  if (meta) out.push(meta)
  for (const item of liturgy.items) {
    out.push('', (item.label || item.kind).toUpperCase())
    if (item.kind === 'Hymn') {
      const hymn = library.hymns.find((h) => h.id === item.hymnId)
      if (hymn) {
        const credit = [
          hymn.lyricist && `Words: ${hymn.lyricist}`,
          hymn.composer && `Music: ${hymn.composer}`,
        ]
        out.push(
          [hymn.title, hymn.hymnal && `(${hymn.hymnal})`].filter(Boolean).join(' '),
          ...credit.filter((c): c is string => Boolean(c)),
        )
        if (hymn.text && !item.text) out.push('', hymn.text)
      }
    }
    if (item.scripture) out.push(item.scripture)
    if (item.text) out.push(item.text)
  }
  if (liturgy.notes) out.push('', 'NOTES', liturgy.notes)
  return out.join('\n')
}
