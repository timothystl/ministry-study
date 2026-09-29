import { describe, expect, it } from 'vitest'
import { findReference, formatReferences, parseReferences, referencesOverlap } from './scripture'

const refs = (text: string) => parseReferences(text).refs
describe('scripture references', () => {
  it('reads chapters, verse ranges, and cross-chapter ranges', () => {
    expect(refs('Luke 15')).toEqual([{ book: 'Luke', start: 15000, end: 15999 }])
    expect(refs('Luke 15:11–32')).toEqual([{ book: 'Luke', start: 15011, end: 15032 }])
    expect(refs('Luke 15:1-16:13')).toEqual([{ book: 'Luke', start: 15001, end: 16013 }])
    expect(refs('Luke 15-16')).toEqual([{ book: 'Luke', start: 15000, end: 16999 }])
  })
  it('handles numbered books, abbreviations, and several passages', () => {
    expect(refs('1 Cor 13:4-7')[0].book).toBe('1 Corinthians')
    expect(refs('I John 4:7-12')[0].book).toBe('1 John')
    expect(refs('Ps 23; John 10:11').map((r) => r.book)).toEqual(['Psalms', 'John'])
    expect(refs('Luke 15; 16:1-9')).toHaveLength(2)
    expect(refs('John 3:16, 18')).toHaveLength(2)
  })
  it('does not mistake ordinary words for references', () => {
    expect(parseReferences('grace').complete).toBe(false)
    expect(parseReferences('is').complete).toBe(false)
    expect(parseReferences('lost sheep').complete).toBe(false)
    expect(parseReferences('Luke 15 grace').complete).toBe(false)
  })
  it('matches by overlap', () => {
    const parable = refs('Luke 15:11-32')
    expect(referencesOverlap(refs('Luke 15'), parable)).toBe(true)
    expect(referencesOverlap(refs('Luke'), parable)).toBe(true)
    expect(referencesOverlap(refs('Luke 15:3'), parable)).toBe(false)
    expect(referencesOverlap(refs('Luke 16'), parable)).toBe(false)
    expect(referencesOverlap(refs('John 15'), parable)).toBe(false)
  })
  it('finds a reference inside a file name', () => {
    expect(findReference('Luke 15 The Lost Son')).toBe('Luke 15')
    expect(findReference('Gen 3:1-7 The Fall')).toBe('Gen 3:1-7')
    expect(findReference('Palm Sunday 2020')).toBe('')
  })
})

describe('filing styles', () => {
  const f = (text: string) => {
    const parsed = parseReferences(text)
    return parsed.complete ? formatReferences(parsed.refs) : null
  }
  it('reads periods, "v", and space-separated lists', async () => {
    expect(f('Matt 13.24-30')).toBe('Matthew 13:24–30')
    expect(f('Isa 42.1-7')).toBe('Isaiah 42:1–7')
    expect(f('Matt 27.11-14 24-26')).toBe('Matthew 27:11–14; Matthew 27:24–26')
    expect(f('Matt 18v1-6,19v13-15')).toBe('Matthew 18:1–6; Matthew 19:13–15')
    expect(f('Matt 5.1-12 Num 6')).toBe('Matthew 5:1–12; Numbers 6')
    expect(f('Matt 4.1-11, Mk 1.9-15')).toBe('Matthew 4:1–11; Mark 1:9–15')
    expect(f('Titus 2:13–14')).toBe('Titus 2:13–14')
    expect(f('galatians')).toBe('Galatians')
    expect(f('Acts')).toBe('Acts')
  })
  it('leaves things that are not passages unread', () => {
    expect(f('Fear and Great Joy')).toBeNull()
    expect(f('Racism-Love')).toBeNull()
    expect(f('Guilt and Shame')).toBeNull()
  })
})
