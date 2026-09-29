import { strToU8, zipSync } from 'fflate'
import { formatReferences, parseReferences } from './scripture'
import { fileIndex, splitCsv, type Sermon } from './sermons'
import type { Library } from './model'
import { REVIEW_BRIEF } from './reviewBrief'
import { fetchAllManuscripts, safeFileName } from './sermonText'

// ----- Catalog export (for a reader such as Claude Cowork) -----
export const CATALOG_HEADERS = [
  'Sermon ID',
  'File Number',
  'Title',
  'Scripture',
  'Date',
  'Series',
  'Occasion',
  'Church Season',
  'Lectionary Year',
  'Themes',
  'Summary',
  'Structure',
  'Structure Category',
  'Central Image',
  'Gospel Statement',
  'Manuscript Location',
  'Text File',
]
const quote = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
export const toCsv = (rows: string[][]) =>
  rows.map((r) => r.map(quote).join(',')).join('\r\n') + '\r\n'
// The file a manuscript is stored under inside the review package.
export const packageFileName = (s: Sermon) =>
  `manuscripts/${safeFileName(s.title)} [${s.id.slice(0, 8)}].txt`
export function catalogCsv(sermons: Sermon[], withText: Set<string> = new Set()) {
  const rows = sermons.map((s) => [
    s.id,
    s.sourceId || fileIndex(s.manuscript),
    s.title,
    s.scripture,
    s.date,
    s.series,
    s.occasion,
    s.season,
    s.lectionaryYear,
    s.themes.join('; '),
    s.summary,
    s.structure,
    s.structureCategory,
    s.centralImage,
    s.gospelHandle,
    s.manuscript,
    withText.has(s.id) ? packageFileName(s) : '',
  ])
  return '﻿' + toCsv([CATALOG_HEADERS, ...rows])
}
export async function buildReviewPackage(
  sermons: Sermon[],
  onProgress: (message: string) => void,
): Promise<{ zip: Uint8Array; withText: number; note: string }> {
  const files: Record<string, Uint8Array> = {}
  let note = ''
  const withText = new Set<string>()
  try {
    const texts = await fetchAllManuscripts((n) => onProgress(`Gathered ${n} manuscripts…`))
    const known = new Map(sermons.map((s) => [s.id, s]))
    for (const item of texts) {
      const sermon = known.get(item.id)
      if (!sermon) continue
      files[packageFileName(sermon)] = strToU8(item.text)
      withText.add(sermon.id)
    }
    if (!texts.length) note = 'No manuscripts are saved yet, so the package has the catalog only.'
  } catch {
    note = 'Manuscripts could not be fetched, so the package has the catalog only.'
  }
  const structures = [
    ...new Map(
      sermons.filter((s) => s.structure).map((s) => [s.structure, s.structureCategory]),
    ).entries(),
  ].sort()
  files['catalog.csv'] = strToU8(catalogCsv(sermons, withText))
  files['README.md'] = strToU8(REVIEW_BRIEF)
  files['structures.txt'] = strToU8(
    structures.length
      ? structures
          .map(([name, category]) => (category ? `${name} (${category})` : name))
          .join('\n') + '\n'
      : 'No structures are recorded yet.\n',
  )
  return { zip: zipSync(files), withText: withText.size, note }
}

// ----- Review import -----
export type ReviewField =
  | 'title'
  | 'scripture'
  | 'date'
  | 'series'
  | 'occasion'
  | 'season'
  | 'themes'
  | 'summary'
  | 'structure'
  | 'structureCategory'
  | 'centralImage'
  | 'gospelHandle'
export const FIELD_LABEL: Record<ReviewField, string> = {
  title: 'Title',
  scripture: 'Passage',
  date: 'Date',
  series: 'Series',
  occasion: 'Occasion',
  season: 'Church season',
  themes: 'Themes',
  summary: 'Summary',
  structure: 'Structure',
  structureCategory: 'Structure category',
  centralImage: 'Central image',
  gospelHandle: 'Gospel statement',
}
const COLUMN: Record<string, ReviewField> = {
  title: 'title',
  scripture: 'scripture',
  date: 'date',
  series: 'series',
  occasion: 'occasion',
  'church season': 'season',
  themes: 'themes',
  summary: 'summary',
  structure: 'structure',
  'structure category': 'structureCategory',
  'central image': 'centralImage',
  'gospel statement': 'gospelHandle',
}
export interface FieldChange {
  key: string // sermon id + field, for accepting one change
  field: ReviewField
  from: string
  to: string
  kind: 'fill' | 'overwrite'
}
export interface SermonReview {
  sermon: Sermon
  changes: FieldChange[]
  note: string
  warnings: string[]
}
export interface ReviewPlan {
  reviews: SermonReview[]
  unmatched: string[]
  unchanged: number
}
const norm = (v: string) => v.normalize('NFKC').replace(/\s+/g, ' ').trim()
const same = (a: string, b: string) => norm(a).toLowerCase() === norm(b).toLowerCase()
const isoDate = (raw: string) => {
  const m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(raw.trim())
  if (!m) return ''
  const [y, mo, d] = [+m[1], +m[2], +m[3]]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return y >= 1950 && y <= 2100 && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
    ? `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    : ''
}
const canonicalPassage = (raw: string) => {
  const parsed = parseReferences(raw)
  return parsed.complete ? formatReferences(parsed.refs) : ''
}
const themeList = (raw: string) => raw.split(/[;\n]/).map(norm).filter(Boolean)
const current = (s: Sermon, field: ReviewField) =>
  field === 'themes' ? s.themes.join('; ') : s[field]

export function parseReview(csv: string): Record<string, string>[] {
  const table = splitCsv(csv.replace(/^﻿/, ''))
  const header = (table.shift() || []).map((h) => norm(h).toLowerCase())
  if (!header.includes('sermon id') && !header.includes('file number'))
    throw new Error('The review needs a “Sermon ID” column. Is this the review.csv?')
  if (!table.length) throw new Error('The review has no sermons in it.')
  return table.map((cells, i) => {
    if (cells.length !== header.length)
      throw new Error(`Row ${i + 2} has the wrong number of columns.`)
    return Object.fromEntries(header.map((h, j) => [h, cells[j] ?? '']))
  })
}
export function planReview(rows: Record<string, string>[], library: Library): ReviewPlan {
  const byId = new Map(library.sermons.map((s) => [s.id, s]))
  const byNumber = new Map<string, Sermon[]>()
  for (const s of library.sermons) {
    const n = s.sourceId
    if (n) byNumber.set(n, [...(byNumber.get(n) || []), s])
  }
  const merged = new Map<string, SermonReview>()
  const unmatched: string[] = []
  let unchanged = 0
  for (const row of rows) {
    const id = norm(row['sermon id'] || '')
    const number = norm(row['file number'] || '')
    const sermon =
      byId.get(id) ||
      (!id && number && byNumber.get(number)?.length === 1 ? byNumber.get(number)![0] : undefined)
    if (!sermon) {
      unmatched.push(id || number || '(no id)')
      continue
    }
    const review = merged.get(sermon.id) || { sermon, changes: [], note: '', warnings: [] }
    for (const [column, field] of Object.entries(COLUMN)) {
      const raw = norm(row[column] || '')
      if (!raw) continue
      let to = raw
      if (field === 'scripture') {
        to = canonicalPassage(raw)
        if (!to) {
          review.warnings.push(`Passage “${raw}” could not be read and was skipped.`)
          continue
        }
      } else if (field === 'date') {
        to = isoDate(raw)
        if (!to) {
          review.warnings.push(`Date “${raw}” is not a valid date and was skipped.`)
          continue
        }
      } else if (field === 'themes') to = themeList(raw).join('; ')
      else if (field === 'summary' || field === 'centralImage' || field === 'gospelHandle')
        to = row[column].trim().replace(/\s+/g, ' ')
      const from = current(sermon, field)
      const before = field === 'scripture' ? canonicalPassage(from) || from : from
      if (same(before, to)) continue
      review.changes.push({
        key: `${sermon.id}:${field}`,
        field,
        from,
        to,
        kind: norm(from) ? 'overwrite' : 'fill',
      })
    }
    const note = [
      row.confidence && `Confidence: ${norm(row.confidence)}.`,
      row.evidence && `Evidence: ${norm(row.evidence)}`,
    ]
      .filter(Boolean)
      .join(' ')
    if (note) review.note = note
    merged.set(sermon.id, review)
  }
  const reviews = [...merged.values()].filter((r) => {
    if (r.changes.length || r.warnings.length) return true
    unchanged++
    return false
  })
  return { reviews, unmatched, unchanged }
}

// Applies only the accepted changes. A replaced title is kept in the sermon's former titles.
export function applyReview(library: Library, plan: ReviewPlan, accepted: Set<string>): Library {
  const now = new Date().toISOString()
  const patches = new Map<string, Sermon>()
  for (const review of plan.reviews) {
    const chosen = review.changes.filter((c) => accepted.has(c.key))
    if (!chosen.length) continue
    const next: Sermon = { ...review.sermon, formerTitles: [...review.sermon.formerTitles] }
    for (const c of chosen) {
      if (c.field === 'themes') next.themes = themeList(c.to)
      else if (c.field === 'title') {
        if (norm(next.title) && !next.formerTitles.includes(next.title))
          next.formerTitles.push(next.title)
        next.title = c.to
      } else next[c.field] = c.to
      if (c.field === 'scripture') next.scriptureSource = 'Review (approved)'
      if (c.field === 'structure') next.structureSource = 'Review (approved)'
    }
    if (review.note) next.reviewNote = review.note
    next.updatedAt = now
    patches.set(next.id, next)
  }
  return { ...library, sermons: library.sermons.map((s) => patches.get(s.id) || s) }
}
