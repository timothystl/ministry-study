import { unzipSync, strFromU8 } from 'fflate'
import { describe, expect, it, vi } from 'vitest'
import type { Library } from './model'
import { applyReview, catalogCsv, parseReview, planReview, toCsv } from './sermonReview'
import { blankSermon, type Sermon } from './sermons'

const sermon = (over: Partial<Sermon>): Sermon => ({ ...blankSermon(), title: 'T', ...over })
const library = (sermons: Sermon[]): Library => ({
  version: 1,
  books: [],
  series: [],
  loans: [],
  sermons,
  prayers: [],
  prayerSets: [],
  sample: false,
})
const a = sermon({
  id: 'aaaa1111-x',
  title: '0812_Lent 4',
  sourceId: '0812',
  scripture: 'Luke 15:11–32',
  date: '2025-03-16',
})
const b = sermon({
  id: 'bbbb2222-x',
  title: 'Waves',
  sourceId: '0020',
  summary: 'Old summary',
  structure: 'Analogy',
  themes: ['grace'],
})

describe('catalog export', () => {
  it('writes a CSV that keeps commas, quotes and line breaks intact', () => {
    const csv = catalogCsv([
      sermon({
        id: 'x1',
        title: 'Grace, "again"',
        summary: 'Line one\nline two',
        themes: ['a', 'b'],
      }),
    ])
    expect(csv.startsWith('﻿Sermon ID,File Number,Title')).toBe(true)
    const rows = parseReview(csv.replace('﻿', ''))
    expect(rows[0]).toMatchObject({
      'sermon id': 'x1',
      title: 'Grace, "again"',
      summary: 'Line one\nline two',
      themes: 'a; b',
    })
    expect(toCsv([['a,b', 'c']])).toBe('"a,b",c\r\n')
  })
  it('names each manuscript file in the catalog', () => {
    const csv = catalogCsv([a], new Set([a.id]))
    expect(csv).toContain('manuscripts/0812_Lent 4 [aaaa1111].txt')
    expect(catalogCsv([a])).not.toContain('manuscripts/')
  })
})

describe('review import', () => {
  const review = `Sermon ID,Title,Scripture,Date,Series,Themes,Summary,Structure,Confidence,Evidence
aaaa1111-x,The Lost Son,Luke 15.11-32,2025-03-16,,"grace; home",A father runs to his son.,Law/Gospel,high,"Opens with the Gospel reading"
bbbb2222-x,,,2024-02-30,,,New summary,Analogy,low,
zzzz,Ghost,,,,,,,,
`
  const plan = planReview(parseReview(review), library([a, b]))
  it('finds fills and overwrites, ignoring blanks and values that already match', () => {
    const first = plan.reviews.find((r) => r.sermon.id === a.id)!
    expect(first.changes.map((c) => [c.field, c.kind])).toEqual([
      ['title', 'overwrite'],
      ['themes', 'fill'],
      ['summary', 'fill'],
      ['structure', 'fill'],
    ]) // the passage and date already agree
    expect(first.note).toBe('Confidence: high. Evidence: Opens with the Gospel reading')
    const second = plan.reviews.find((r) => r.sermon.id === b.id)!
    expect(second.changes.map((c) => [c.field, c.kind])).toEqual([['summary', 'overwrite']]) // same structure
    expect(second.warnings).toEqual(['Date “2024-02-30” is not a valid date and was skipped.'])
    expect(plan.unmatched).toEqual(['zzzz'])
  })
  it('applies only accepted changes and keeps the former title', () => {
    const accepted = new Set(
      plan.reviews[0].changes.filter((c) => c.field !== 'summary').map((c) => c.key),
    )
    const out = applyReview(library([a, b]), plan, accepted)
    const changed = out.sermons.find((s) => s.id === a.id)!
    expect(changed).toMatchObject({
      title: 'The Lost Son',
      themes: ['grace', 'home'],
      structure: 'Law/Gospel',
      structureSource: 'Review (approved)',
    })
    expect(changed.summary).toBe('')
    expect(changed.formerTitles).toEqual(['0812_Lent 4'])
    expect(changed.reviewNote).toContain('Confidence: high')
    expect(out.sermons.find((s) => s.id === b.id)).toEqual(b)
  })
  it('never changes anything when nothing is accepted', () => {
    expect(applyReview(library([a, b]), plan, new Set()).sermons).toEqual([a, b])
  })
  it('matches by file number when there is no sermon id, and only when it is unique', () => {
    const byNumber = planReview(parseReview('File Number,Summary\n0020,Hello\n'), library([a, b]))
    expect(byNumber.reviews[0].sermon.id).toBe(b.id)
    const twin = planReview(
      parseReview('File Number,Summary\n0020,Hello\n'),
      library([b, { ...b, id: 'other' }]),
    )
    expect(twin.unmatched).toEqual(['0020'])
  })
  it('rejects files that are not a review', () => {
    expect(() => parseReview('Title,Summary\nA,B\n')).toThrow(/Sermon ID/)
    expect(() => parseReview('Sermon ID,Title\n')).toThrow(/no sermons/)
    expect(() => parseReview('Sermon ID,Title\nx\n')).toThrow(/wrong number/)
  })
})

describe('review package', () => {
  it('contains the catalog, the instructions, the structures and each manuscript', async () => {
    vi.stubGlobal(
      'fetch',
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.includes('after=aaaa')
              ? []
              : [{ id: a.id, text: 'A father had two sons.', fileName: 'x.docx' }],
          ),
          { headers: { 'Content-Type': 'application/json' } },
        ),
    )
    const { buildReviewPackage } = await import('./sermonReview')
    const { zip, withText } = await buildReviewPackage([a, b], () => undefined)
    const files = unzipSync(zip)
    expect(Object.keys(files).sort()).toEqual([
      'README.md',
      'catalog.csv',
      'manuscripts/0812_Lent 4 [aaaa1111].txt',
      'structures.txt',
    ])
    expect(withText).toBe(1)
    expect(strFromU8(files['README.md'])).toContain('review.csv')
    expect(strFromU8(files['structures.txt'])).toBe('Analogy\n')
    expect(strFromU8(files['manuscripts/0812_Lent 4 [aaaa1111].txt'])).toBe(
      'A father had two sons.',
    )
    vi.unstubAllGlobals()
  })
})

describe('review package and private occasions', () => {
  it('leaves funeral and wedding sermons out unless asked', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } }),
    )
    const { buildReviewPackage } = await import('./sermonReview')
    const funeral = sermon({ id: 'ffff0000-x', title: 'Hope at the grave', occasion: 'Funeral' })
    const plain = sermon({ id: 'aaaa0000-x', title: 'Waves' })
    const out = await buildReviewPackage([funeral, plain], () => undefined)
    const csv = strFromU8(unzipSync(out.zip)['catalog.csv'])
    expect(out.leftOut).toBe(1)
    expect(csv).toContain('Waves')
    expect(csv).not.toContain('Hope at the grave')
    const all = await buildReviewPackage([funeral, plain], () => undefined, true)
    expect(all.leftOut).toBe(0)
    expect(strFromU8(unzipSync(all.zip)['catalog.csv'])).toContain('Hope at the grave')
    vi.unstubAllGlobals()
  })
})
