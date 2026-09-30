import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bookNumber,
  clearBibleCache,
  defaultVersionIds,
  loadChapter,
  passagesFor,
  testamentOf,
  versions,
  versionsFor,
} from './bible'

afterEach(() => {
  clearBibleCache()
  vi.unstubAllGlobals()
})
describe('bible versions', () => {
  it('numbers books and tells the testaments apart', () => {
    expect(bookNumber('Genesis')).toBe(1)
    expect(bookNumber('John')).toBe(43)
    expect(bookNumber('Revelation')).toBe(66)
    expect(testamentOf('Malachi')).toBe('OT')
    expect(testamentOf('Matthew')).toBe('NT')
  })
  it('offers the original language of each testament, plus English', () => {
    expect(versionsFor('OT').some((v) => v.language === 'Hebrew')).toBe(true)
    expect(versionsFor('NT').some((v) => v.language === 'Greek')).toBe(true)
    expect(versionsFor('OT').some((v) => v.id === 'weymouth')).toBe(false)
    for (const t of ['OT', 'NT'] as const)
      for (const id of defaultVersionIds(t))
        expect(versions.find((v) => v.id === id)?.covers).toContain(t)
  })
})
describe('passages', () => {
  it('splits a reference into chapters with the verses to show', () => {
    expect(passagesFor('John 3:16-21').passages).toEqual([
      { book: 'John', chapter: 3, first: 16, last: 21 },
    ])
    expect(passagesFor('Luke 15:30-16:2').passages).toEqual([
      { book: 'Luke', chapter: 15, first: 30, last: 999 },
      { book: 'Luke', chapter: 16, first: 1, last: 2 },
    ])
    expect(passagesFor('Psalm 23').passages[0]).toMatchObject({ first: 1, last: 999 })
  })
  it('asks for a chapter, and refuses text that is not a passage or is too long', () => {
    expect(passagesFor('John').error).toMatch(/chapter/)
    expect(passagesFor('grace').error).toMatch(/passage/)
    expect(passagesFor('Genesis 1-20').error).toMatch(/12 chapters/)
    expect(passagesFor('').error).toBe('')
  })
})
describe('loading a chapter', () => {
  it('reads verses once and keeps them', async () => {
    const fetcher = vi.fn(async (_url: string) => ({
      ok: true,
      status: 200,
      json: async () => ({ verses: [{ verse: 1, text: ' In the beginning ' }] }),
    }))
    vi.stubGlobal('fetch', fetcher)
    expect(await loadChapter('web', 'Genesis', 1)).toEqual([{ verse: 1, text: 'In the beginning' }])
    await loadChapter('web', 'Genesis', 1)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toBe('https://api.getbible.net/v2/web/1/1.json')
  })
  it('treats a missing chapter as empty, and does not remember a failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404 })),
    )
    expect(await loadChapter('tischendorf', 'Genesis', 1)).toEqual([])
    clearBibleCache()
    const fetcher = vi.fn(async () => ({ ok: false, status: 500 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(loadChapter('web', 'Genesis', 2)).rejects.toThrow()
    await expect(loadChapter('web', 'Genesis', 2)).rejects.toThrow()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
