import { describe, expect, it } from 'vitest'
import type { Library } from './model'
import { parseSermonList, previewSermonImport } from './sermons'
import {
  parseStructureTable,
  parseTextHistory,
  previewStructure,
  previewTextHistory,
} from './sermonImport'

const empty = (): Library => ({
  version: 1,
  books: [],
  series: [],
  loans: [],
  sermons: [],
  prayers: [],
  prayerSets: [],
  sample: false,
})
// Invented entries in the same shapes as a real archive index, text history and structure review.
const INDEX = `﻿Index,Date,Year,Liturgical Season,Liturgical Sunday,Lectionary Year,Occasion,Scripture,Series,Title,Current Filename,Path,Folder,SuggestedFilename
1,2005.01.09,2005,Epiphany,Epiphany 1,A,Epiphany 1,Isa 42.1-7,,Waves,0001_Epiphany 1_Waves.docx,2005-Current/0001_Epiphany 1_Waves.docx,2005-Current,0001_Epiphany 1_Waves.docx
2,2005.02.06,2005,Lent,Lent 2,A,Lent 2,Matt 27.11-14 24-26,Stewardship,Wheat,0003_Lent 2_Wheat.docx,2005-Current/0003_Lent 2_Wheat.docx,2005-Current,0002_Lent 2_Wheat.docx
3,,,,,,,Fear and Great Joy,,Joy,2005.04.02_Easter_Joy.docx,2005-Current/2005.04.02_Easter_Joy.docx,2005-Current,0003_Easter_Joy.docx
,,,,,,,,,,,,,
`
const HISTORY = `# Sermon Text History

## Isaiah

### Isaiah 42:1-7

**“Waves”** — 2005-01-09 (Epiphany 1)

- **Opens:** “When the waves come.”
- **Closes:** “You are held.”
- **Central image:** A tide that cannot be argued with.
- **Gospel handle:** “Christ is your shore.”
- **File:** \`0001_Epiphany 1_Waves.docx\`

## Matthew

### Matthew 13:24-30

**“Wheat”** — 2005-02-06 (Lent 2, Series: *Growing*) — text identified from manuscript\\*

- **Opens:** “A field.”
- **File:** \`0002_Lent 2_Wheat.docx\`

## Appendix: Not Filed Under a Biblical Book

- **“Creed Talk”** — 2009-07-19 — unparsed reference: "Creed". File: \`0900_Creed_Talk.docx\`
  - Central image: The wind.
`
const STRUCTURE = [
  ['#', 'File Name', 'Season / Title', 'Structure', 'Category', 'Era', 'Confidence', 'Rationale'],
  [
    '1',
    '0001_Epiphany 1_Waves',
    'x',
    'Central Image',
    'Dynamic',
    'Historical',
    'high',
    'Waves govern the sermon.',
  ],
  [
    '2',
    '0002_Lent 2_Wheat',
    'x',
    'Law/Gospel',
    'Dynamic',
    'Historical',
    'low',
    'Accusation then gift.',
  ],
  ['3', '0777_Nowhere', 'x', 'Analogy', 'Thematic', 'Historical', 'high', 'No such sermon.'],
]

describe('archive index import', () => {
  const rows = parseSermonList(INDEX, 'OneDrive/Sermons')
  it('reads the index, skipping empty rows and reporting unreadable cells', () => {
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({
      title: 'Waves',
      scripture: 'Isaiah 42:1–7',
      date: '2005-01-09',
      season: 'Epiphany',
      liturgicalDay: 'Epiphany 1',
      lectionaryYear: 'A',
      manuscript: 'OneDrive/Sermons/2005-Current/0001_Epiphany 1_Waves.docx',
    })
    expect(rows[1].scripture).toBe('Matthew 27:11–14; Matthew 27:24–26')
    expect(rows[2].scripture).toBe('')
    expect(rows[2].warnings).toEqual(['passage “Fear and Great Joy” not read'])
  })
  it('keys each sermon by the suggested file number, keeps the current location', () => {
    expect(rows.map((r) => r.sourceId)).toEqual(['0001', '0002', '0003'])
    expect(rows[1].manuscript).toContain('0003_Lent 2_Wheat.docx')
  })
  it('keeps two different files that share a title and date', () => {
    const twin = parseSermonList(
      'Title,Date,Path\nWorship,2025.03.02,a/0001_Worship.docx\nWorship,2025.03.02,a/0002_Worship.docx\n',
    )
    expect(previewSermonImport(twin, empty()).added).toBe(2)
  })
})

describe('text history and structure review', () => {
  const base = previewSermonImport(parseSermonList(INDEX), empty()).library
  it('reads the history, including the appendix', () => {
    const entries = parseTextHistory(HISTORY)
    expect(entries.map((e) => e.index)).toEqual(['0001', '0002', '0900'])
    expect(entries[0]).toMatchObject({
      opening: 'When the waves come.',
      closing: 'You are held.',
      gospelHandle: 'Christ is your shore.',
      scripture: 'Isaiah 42:1-7',
    })
    expect(entries[1]).toMatchObject({ occasion: 'Lent 2', series: 'Growing' })
    expect(entries[2]).toMatchObject({ scripture: '', centralImage: 'The wind.' })
  })
  it('fills only empty fields, adds unmatched sermons, and never overwrites', () => {
    const edited = {
      ...base,
      sermons: base.sermons.map((s) =>
        s.sourceId === '0001' ? { ...s, centralImage: 'My own words' } : s,
      ),
    }
    const preview = previewTextHistory(parseTextHistory(HISTORY), edited)
    const [waves, wheat] = preview.library.sermons
    expect(waves.centralImage).toBe('My own words')
    expect(waves.opening).toBe('When the waves come.')
    expect(wheat.series).toBe('Stewardship')
    expect(preview.added).toBe(1)
    expect(preview.library.sermons.at(-1)).toMatchObject({
      title: 'Creed Talk',
      source: 'Text history',
    })
  })
  it('fills a missing passage from the manuscript and says so', () => {
    const joy = base.sermons[2]
    expect(joy.scripture).toBe('')
    const withJoy = parseTextHistory(
      HISTORY.replace('0002_Lent 2_Wheat', '0003_Easter_Joy').replace(
        'Matthew 13:24-30',
        'Luke 2:8-14',
      ),
    )
    const out = previewTextHistory(withJoy, base).library.sermons[2]
    expect(out.scripture).toBe('Luke 2:8–14')
    expect(out.scriptureSource).toBe('Identified from the manuscript')
  })
  it('adds structure by file number and reports unmatched rows', () => {
    const preview = previewStructure(parseStructureTable(STRUCTURE), base)
    expect(preview.updated).toBe(2)
    expect(preview.unmatched).toBe(1)
    expect(preview.library.sermons[1]).toMatchObject({
      structure: 'Law/Gospel',
      structureConfidence: 'low',
      structureSource: 'AI review against the Schmitt taxonomy',
    })
    expect(() => parseStructureTable([['a', 'b']])).toThrow(/File Name/)
  })
  it('rejects a file that is not a text history', () => {
    expect(() => parseTextHistory('# Something else')).toThrow(/No sermons/)
  })
})
