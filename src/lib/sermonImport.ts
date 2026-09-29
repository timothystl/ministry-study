import type { Library } from './model'
import { formatReferences, parseReferences } from './scripture'
import { blankSermon, fileIndex, splitCsv, type Sermon } from './sermons'

// Two reviews of the archive can be laid over an imported sermon list. Both match a sermon by the
// number at the start of its file name (0876_Proper 12_Vocation_Labor.docx is sermon 0876) and
// only fill fields that are still empty, so nothing typed by hand is ever replaced.
const indexOf = fileIndex
const indexKey = (s: Sermon) => s.sourceId || indexOf(s.manuscript)
const stripQuotes = (text: string) =>
  text
    .trim()
    .replace(/^[“"]\s*/, '')
    .replace(/\s*[”"]$/, '')

// ----- Text history (markdown) -----
export interface HistoryEntry {
  index: string
  file: string
  title: string
  date: string
  occasion: string
  series: string
  scripture: string
  opening: string
  closing: string
  centralImage: string
  gospelHandle: string
}
export function parseTextHistory(markdown: string): HistoryEntry[] {
  const entries: HistoryEntry[] = []
  let heading = ''
  let appendix = false
  let current: HistoryEntry | null = null
  const start = /^(?:-\s+)?\*\*[“"](.+?)[”"]\*\*\s+—\s+(\d{4}-\d{2}-\d{2})(.*)$/
  const finish = () => {
    if (current?.index) entries.push(current)
    current = null
  }
  for (const line of markdown.replace(/^﻿/, '').split(/\r?\n/)) {
    const h2 = /^##\s+(.*)$/.exec(line)
    if (h2 && !line.startsWith('###')) {
      finish()
      appendix = /^Appendix/i.test(h2[1])
      heading = ''
      continue
    }
    const h3 = /^###\s+(.*)$/.exec(line)
    if (h3) {
      finish()
      heading = h3[1].trim()
      continue
    }
    const m = start.exec(line)
    if (m) {
      finish()
      const rest = m[3]
      const paren = /^\s*\(([^)]*)\)/.exec(rest)?.[1] || ''
      const [occasion, ...more] = paren.split(/,\s*Series:\s*/)
      const file = /File:\s*`([^`]+)`/.exec(rest)?.[1] || ''
      current = {
        index: indexOf(file),
        file,
        title: m[1].trim(),
        date: m[2],
        occasion: occasion.replace(/\*/g, '').trim(),
        series: more.join(', ').replace(/\*/g, '').trim(),
        scripture: appendix ? '' : heading,
        opening: '',
        closing: '',
        centralImage: '',
        gospelHandle: '',
      }
      continue
    }
    if (!current) continue
    const field = /^\s*-\s+\*\*(Opens|Closes|Central image|Gospel handle|File):\*\*\s*(.*)$/.exec(
      line,
    )
    if (field) {
      const value = field[2].trim()
      if (field[1] === 'Opens') current.opening = stripQuotes(value)
      else if (field[1] === 'Closes') current.closing = stripQuotes(value)
      else if (field[1] === 'Central image') current.centralImage = value
      else if (field[1] === 'Gospel handle') current.gospelHandle = stripQuotes(value)
      else {
        current.file = value.replace(/`/g, '')
        current.index = indexOf(current.file)
      }
      continue
    }
    const image = /^\s+-\s+Central image:\s*(.*)$/.exec(line)
    if (image) current.centralImage = image[1].trim()
  }
  finish()
  if (!entries.length)
    throw new Error('No sermons were found in this file. Is it the sermon text history?')
  return entries
}
export interface EnrichPreview {
  library: Library
  updated: number
  added: number
  unmatched: number
  filled: Record<string, number>
}
function passageFromHeading(heading: string) {
  const parsed = parseReferences(heading)
  return parsed.complete ? formatReferences(parsed.refs) : ''
}
export function previewTextHistory(entries: HistoryEntry[], library: Library): EnrichPreview {
  const byIndex = new Map(
    library.sermons.map((s) => [indexKey(s), s]).filter(([k]) => k) as [string, Sermon][],
  )
  const filled: Record<string, number> = {}
  const patched = new Map<string, Sermon>()
  const additions: Sermon[] = []
  const mark = (field: string) => (filled[field] = (filled[field] || 0) + 1)
  for (const entry of entries) {
    const sermon = byIndex.get(entry.index)
    if (!sermon) {
      additions.push({
        ...blankSermon(),
        title: entry.title,
        date: entry.date,
        occasion: entry.occasion,
        series: entry.series,
        scripture: passageFromHeading(entry.scripture),
        scriptureSource: entry.scripture ? 'Text history' : '',
        manuscript: entry.file,
        sourceId: entry.index,
        opening: entry.opening,
        closing: entry.closing,
        centralImage: entry.centralImage,
        gospelHandle: entry.gospelHandle,
        source: 'Text history',
        updatedAt: new Date().toISOString(),
      })
      continue
    }
    const next = { ...sermon }
    const fill = (
      field: 'opening' | 'closing' | 'centralImage' | 'gospelHandle' | 'series',
      value: string,
    ) => {
      if (value && !next[field]) {
        next[field] = value
        mark(field)
      }
    }
    fill('opening', entry.opening)
    fill('closing', entry.closing)
    fill('centralImage', entry.centralImage)
    fill('gospelHandle', entry.gospelHandle)
    fill('series', entry.series)
    const passage = passageFromHeading(entry.scripture)
    if (passage && !next.scripture) {
      next.scripture = passage
      next.scriptureSource = 'Identified from the manuscript'
      mark('scripture')
    }
    if (entry.date && !next.date) {
      next.date = entry.date
      mark('date')
    }
    if (!next.sourceId) next.sourceId = entry.index
    if (JSON.stringify(next) !== JSON.stringify(sermon)) {
      next.updatedAt = new Date().toISOString()
      patched.set(sermon.id, next)
    }
  }
  return {
    library: {
      ...library,
      sermons: [...library.sermons.map((s) => patched.get(s.id) || s), ...additions],
    },
    updated: patched.size,
    added: additions.length,
    unmatched: 0,
    filled,
  }
}

// ----- Structure review (spreadsheet) -----
export interface StructureRow {
  index: string
  structure: string
  category: string
  confidence: string
  rationale: string
}
export function parseStructureTable(table: string[][]): StructureRow[] {
  const header = (table[0] || []).map((c) =>
    String(c ?? '')
      .trim()
      .toLowerCase(),
  )
  const col = (name: string) => header.indexOf(name)
  if (col('file name') < 0 || col('structure') < 0)
    throw new Error(
      'Expected columns “File Name” and “Structure”. Is this the sermon structure database?',
    )
  const cell = (row: string[], name: string) => String(row[col(name)] ?? '').trim()
  const rows = table
    .slice(1)
    .map((row) => ({
      index: indexOf(cell(row, 'file name')),
      structure: cell(row, 'structure'),
      category: cell(row, 'category'),
      confidence: cell(row, 'confidence'),
      rationale: cell(row, 'rationale'),
    }))
    .filter((r) => r.index && r.structure)
  if (!rows.length) throw new Error('No classified sermons were found in this file.')
  return rows
}
// A spreadsheet (.xlsx, first sheet) or a CSV export of it.
export async function readStructureFile(file: File): Promise<StructureRow[]> {
  if (file.size > 10_000_000) throw new Error('Please choose a file smaller than 10 MB.')
  if (/\.csv$/i.test(file.name)) return parseStructureTable(splitCsv(await file.text()))
  const { readSheet } = await import('read-excel-file/browser')
  const rows = (await readSheet(file)) as unknown[][]
  return parseStructureTable(rows.map((row) => row.map((c) => String(c ?? ''))))
}
export const STRUCTURE_SOURCE = 'AI review against the Schmitt taxonomy'
export function previewStructure(rows: StructureRow[], library: Library): EnrichPreview {
  const byIndex = new Map(rows.map((r) => [r.index, r]))
  let updated = 0
  const sermons = library.sermons.map((s) => {
    const row = byIndex.get(indexKey(s))
    if (!row || s.structure) return s
    updated++
    return {
      ...s,
      structure: row.structure,
      structureCategory: row.category,
      structureConfidence: row.confidence,
      structureNote: row.rationale,
      structureSource: STRUCTURE_SOURCE,
      updatedAt: new Date().toISOString(),
    }
  })
  const known = new Set(library.sermons.map(indexKey))
  return {
    library: { ...library, sermons },
    updated,
    added: 0,
    unmatched: rows.filter((r) => !known.has(r.index)).length,
    filled: { structure: updated },
  }
}
