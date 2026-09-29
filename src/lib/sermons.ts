import type { Library } from './model'
import { findReference, formatReferences, parseReferences, referencesOverlap } from './scripture'

// A sermon record is a catalog entry, not the sermon itself. The manuscript and recording stay
// where they are (OneDrive, a computer folder, YouTube); the record holds a link or location.
export interface Sermon {
  id: string
  title: string
  scripture: string
  date: string // YYYY-MM-DD, only when known
  occasion: string
  series: string
  themes: string[]
  summary: string
  notes: string
  manuscript: string
  recording: string
  // From an archive index or review, kept separate from what was typed by hand.
  sourceId: string
  season: string
  lectionaryYear: string
  liturgicalDay: string
  scriptureSource: string
  structure: string
  structureCategory: string
  structureConfidence: string
  structureNote: string
  structureSource: string
  centralImage: string
  gospelHandle: string
  opening: string
  closing: string
  source: string
  updatedAt: string
}
export const blankSermon = (): Sermon => ({
  id: crypto.randomUUID(),
  title: '',
  scripture: '',
  date: '',
  occasion: '',
  series: '',
  themes: [],
  summary: '',
  notes: '',
  manuscript: '',
  recording: '',
  sourceId: '',
  season: '',
  lectionaryYear: '',
  liturgicalDay: '',
  scriptureSource: '',
  structure: '',
  structureCategory: '',
  structureConfidence: '',
  structureNote: '',
  structureSource: '',
  centralImage: '',
  gospelHandle: '',
  opening: '',
  closing: '',
  source: '',
  updatedAt: '',
})
const normalize = (value: string) =>
  value.trim().normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ')
export const isWebLink = (location: string) => /^https?:\/\/\S+$/i.test(location.trim())
export const sermonYear = (s: Sermon) => s.date.slice(0, 4)

export function saveSermon(library: Library, sermon: Sermon): Library {
  const title = sermon.title.trim()
  if (!title) throw new Error('A sermon needs a title.')
  if (sermon.date && !/^\d{4}-\d{2}-\d{2}$/.test(sermon.date)) throw new Error('Use a valid date.')
  const saved: Sermon = {
    ...sermon,
    title,
    themes: sermon.themes.map((t) => t.trim()).filter(Boolean),
    updatedAt: new Date().toISOString(),
  }
  const exists = library.sermons.some((s) => s.id === sermon.id)
  return {
    ...library,
    sermons: exists
      ? library.sermons.map((s) => (s.id === sermon.id ? saved : s))
      : [...library.sermons, saved],
  }
}
export const deleteSermon = (library: Library, id: string): Library => ({
  ...library,
  sermons: library.sermons.filter((s) => s.id !== id),
})
const byDate = (a: Sermon, b: Sermon) =>
  (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title)
export const sortSermons = (sermons: Sermon[]) => [...sermons].sort(byDate)

// Other sermons on an overlapping passage: "have I preached on this before?"
export function samePassage(library: Library, sermon: Sermon) {
  const refs = parseReferences(sermon.scripture).refs
  if (!refs.length) return []
  return sortSermons(
    library.sermons.filter(
      (s) => s.id !== sermon.id && referencesOverlap(refs, parseReferences(s.scripture).refs),
    ),
  )
}

export interface SermonHit {
  sermon: Sermon
  reasons: string[]
  snippet?: string
}
export interface SermonFilters {
  series?: string
  year?: string
  season?: string
  structure?: string
}
// Passage searches match by chapter and verse overlap; everything else is a case-insensitive AND
// across title, passage, themes, series, occasion, summary and notes. Each result says why it
// matched. File contents are never searched, only what is recorded here.
export function searchSermons(
  sermons: Sermon[],
  query: string,
  filters: SermonFilters = {},
): SermonHit[] {
  const pool = sortSermons(sermons).filter(
    (s) =>
      (!filters.series || s.series === filters.series) &&
      (!filters.year || sermonYear(s) === filters.year),
  )
  const q = normalize(query)
  if (!q) return pool.map((sermon) => ({ sermon, reasons: [] }))
  const parsed = parseReferences(query)
  const words = q.split(' ')
  const hits = new Map<string, SermonHit>()
  if (parsed.complete)
    for (const sermon of pool)
      if (referencesOverlap(parsed.refs, parseReferences(sermon.scripture).refs))
        hits.set(sermon.id, { sermon, reasons: ['Passage'] })
  for (const sermon of pool) {
    const fields: [string, string][] = [
      ['title', sermon.title],
      ['passage', sermon.scripture],
      ['themes', sermon.themes.join(' ')],
      ['series', sermon.series],
      ['occasion', `${sermon.occasion} ${sermon.liturgicalDay} ${sermon.season}`],
      ['structure', sermon.structure],
      ['central image', sermon.centralImage],
      ['gospel statement', sermon.gospelHandle],
      ['opening and closing', `${sermon.opening} ${sermon.closing}`],
      ['summary', sermon.summary],
      ['notes', sermon.notes],
      ['location', `${sermon.manuscript} ${sermon.recording}`],
    ]
    const text = fields.map(([, v]) => normalize(v)).join(' \n ')
    if (!words.every((w) => text.includes(w))) continue
    const where = fields
      .filter(([, v]) => words.some((w) => normalize(v).includes(w)))
      .map(([k]) => k)
    const hit = hits.get(sermon.id)
    // A passage match already explains a hit in the passage field.
    const other = hit ? where.filter((w) => w !== 'passage') : where
    if (hit) {
      if (other.length) hit.reasons.push(`Text in ${other.join(', ')}`)
    } else hits.set(sermon.id, { sermon, reasons: [`Text in ${where.join(', ')}`] })
  }
  return sortSermons([...hits.values()].map((h) => h.sermon)).map((s) => hits.get(s.id)!)
}

// ----- Bulk import -----
export interface SermonRow {
  title: string
  scripture: string
  date: string
  series: string
  occasion: string
  manuscript: string
  themes: string
  sourceId: string
  season: string
  lectionaryYear: string
  liturgicalDay: string
  detected: string[] // what was read from a file name, for the reviewer to check
  warnings: string[] // things in the list that could not be read and were left blank
}
const EXTENSION = /\.(docx?|pdf|pages|txt|rtf|odt|pptx?|key|mp3|mp4|m4a|mov|wav)$/i
const validDate = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m - 1, d))
  return (
    y >= 1950 &&
    y <= 2100 &&
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  )
}
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const validDateParts = (m: RegExpExecArray) => validDate(+m[1], +m[2], +m[3])
// Only unambiguous dates: 2025-03-16, 2025.03.16, 20250316, or 03-16-2025 (US order).
export function readDate(text: string): { date: string; rest: string } {
  let m = /^\s*(\d{4})[-._](\d{1,2})[-._](\d{1,2})\b[\s_.-]*/.exec(text)
  if (m && validDateParts(m))
    return { date: iso(+m[1], +m[2], +m[3]), rest: text.slice(m[0].length) }
  m = /^\s*(\d{4})(\d{2})(\d{2})\b[\s_.-]*/.exec(text)
  if (m && validDateParts(m))
    return { date: iso(+m[1], +m[2], +m[3]), rest: text.slice(m[0].length) }
  m = /^\s*(\d{1,2})[-._](\d{1,2})[-._](\d{4})\b[\s_.-]*/.exec(text)
  if (m && validDate(+m[3], +m[1], +m[2]))
    return { date: iso(+m[3], +m[1], +m[2]), rest: text.slice(m[0].length) }
  return { date: '', rest: text }
}
// A date cell: the whole cell must be a date.
const readDateCell = (cell: string) => {
  const { date, rest } = readDate(cell.trim() + ' ')
  return date && !rest.trim() ? date : ''
}
// Writes a passage one way, or reports that it could not be read (and keeps nothing).
export function tidyPassage(raw: string): { text: string; unread: boolean } {
  if (!raw.trim()) return { text: '', unread: false }
  const parsed = parseReferences(raw)
  return parsed.complete
    ? { text: formatReferences(parsed.refs), unread: false }
    : { text: '', unread: true }
}
const blankRow = (): SermonRow => ({
  title: '',
  scripture: '',
  date: '',
  series: '',
  occasion: '',
  manuscript: '',
  themes: '',
  sourceId: '',
  season: '',
  lectionaryYear: '',
  liturgicalDay: '',
  detected: [],
  warnings: [],
})
// File-name lines: "2025-03-16 Luke 15 The Lost Son.docx". Only a leading date and a written
// scripture reference are read; the rest becomes the title. Nothing else is guessed.
export function parseSermonLine(line: string, folder = ''): SermonRow {
  const detected: string[] = []
  const name = line.trim()
  const withoutExt = name.replace(EXTENSION, '')
  const { date, rest } = readDate(withoutExt.replace(/_/g, ' '))
  if (date) detected.push('date')
  let title = rest.trim()
  const scripture = findReference(title)
  if (scripture) {
    detected.push('passage')
    const cleaned = title
      .replace(scripture, ' ')
      .replace(/^[\s\-–—:,.]+|[\s\-–—:,.]+$/g, '')
      .replace(/\s+/g, ' ')
    title = cleaned || scripture
  }
  const manuscript = folder ? `${folder.replace(/[\\/]+$/, '')}/${name}` : name
  return { ...blankRow(), title, scripture, date, manuscript, detected }
}
export function splitCsv(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const endRow = () => {
    row.push(field)
    field = ''
    if (row.some((v) => v.trim())) rows.push(row)
    row = []
  }
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"' && !field) quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      endRow()
      if (c === '\r' && input[i + 1] === '\n') i++
    } else field += c
  }
  if (quoted) throw new Error('A quoted CSV field is unfinished.')
  endRow()
  return rows
}
export const CSV_HEADERS = 'Title,Scripture,Date,Series,Occasion,Themes,Location'
// The file name part of a path, without number prefix or extension, as a fallback title.
const titleFromFile = (file: string) =>
  file.split(/[\\/]/).pop()!.replace(EXTENSION, '').replace(/^\d+_/, '').split('_').pop()!.trim()
// The number at the start of a file name: 0876_Proper 12_Labor.docx is sermon 0876.
export const fileIndex = (file: string) =>
  /^(\d{3,5})_/.exec(file.trim().split(/[\\/]/).pop() || '')?.[1] || ''
// CSV with a Title column, or one file name per line. Recognized columns: Title, Scripture, Date,
// Series, Occasion, Themes, Location (or Path), Index, Liturgical Season, Liturgical Sunday,
// Lectionary Year. Anything that cannot be read is left blank and reported, never guessed.
export function parseSermonList(text: string, folder = ''): SermonRow[] {
  text = text.replace(/^﻿/, '')
  const first = text.split(/\r?\n/, 1)[0] || ''
  let rows: SermonRow[]
  if (/(^|,)\s*"?title"?\s*(,|$)/i.test(first) && first.includes(',')) {
    const table = splitCsv(text)
    const header = table.shift()!.map(normalize)
    if (new Set(header).size !== header.length) throw new Error('CSV column names must be unique.')
    rows = table.flatMap((cells, i) => {
      if (cells.length !== header.length)
        throw new Error(`CSV row ${i + 2} has the wrong number of columns.`)
      const value = (name: string) => (cells[header.indexOf(name)] || '').trim()
      const warnings: string[] = []
      const path = value('path') || value('location')
      const file = value('current filename') || path
      const title = value('title') || titleFromFile(file)
      if (!title) throw new Error(`CSV row ${i + 2} needs a title.`)
      if (!value('title')) warnings.push('no title; used the file name')
      let date = ''
      if (value('date')) {
        date = readDateCell(value('date'))
        if (!date) warnings.push(`date “${value('date')}” not read`)
      }
      const passage = tidyPassage(value('scripture'))
      if (passage.unread) warnings.push(`passage “${value('scripture')}” not read`)
      const folderPart = folder.replace(/[\\/]+$/, '')
      return [
        {
          ...blankRow(),
          title,
          scripture: passage.text,
          date,
          series: value('series'),
          occasion: value('occasion'),
          manuscript: path && folderPart && !isWebLink(path) ? `${folderPart}/${path}` : path,
          themes: value('themes'),
          // Other reviews of the archive use the numbering of the suggested file names, so that number
          // is the key; the location stays the file's current path.
          sourceId: fileIndex(value('suggestedfilename')) || fileIndex(file),
          season: value('liturgical season'),
          lectionaryYear: value('lectionary year'),
          liturgicalDay: value('liturgical sunday'),
          warnings,
        },
      ]
    })
  } else {
    rows = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => parseSermonLine(l, folder))
  }
  if (!rows.length) throw new Error('There is nothing to import.')
  if (rows.length > 3000) throw new Error('Please import at most 3,000 sermons at a time.')
  return rows
}
export interface SermonImportPreview {
  library: Library
  entries: { row: SermonRow; action: 'Add' | 'Already listed' }[]
  added: number
}
// A file number or file location identifies a sermon. Title and date are used only when neither
// exists, since two different files can share both.
const identity = (s: { manuscript: string; title: string; date: string; sourceId: string }) =>
  s.sourceId || s.manuscript
    ? [s.sourceId ? `id:${s.sourceId}` : '', s.manuscript ? `loc:${normalize(s.manuscript)}` : '']
    : [`td:${normalize(s.title)}|${s.date}`]
export function previewSermonImport(rows: SermonRow[], library: Library): SermonImportPreview {
  const seen = new Set(library.sermons.flatMap(identity).filter(Boolean))
  const additions: Sermon[] = []
  const entries: SermonImportPreview['entries'] = []
  for (const row of rows) {
    const keys = identity(row).filter(Boolean)
    if (keys.some((k) => seen.has(k))) {
      entries.push({ row, action: 'Already listed' })
      continue
    }
    keys.forEach((k) => seen.add(k))
    entries.push({ row, action: 'Add' })
    additions.push({
      ...blankSermon(),
      title: row.title,
      scripture: row.scripture,
      scriptureSource: row.scripture ? 'Sermon list' : '',
      date: row.date,
      series: row.series,
      occasion: row.occasion,
      manuscript: row.manuscript,
      themes: row.themes
        .split(';')
        .map((t) => t.trim())
        .filter(Boolean),
      sourceId: row.sourceId,
      season: row.season,
      lectionaryYear: row.lectionaryYear,
      liturgicalDay: row.liturgicalDay,
      source: 'Imported list',
      updatedAt: new Date().toISOString(),
    })
  }
  return {
    library: { ...library, sermons: [...library.sermons, ...additions] },
    entries,
    added: additions.length,
  }
}
