import { describe, expect, it, vi } from 'vitest'
import {
  fetchNetChapter,
  fetchYvpChapter,
  listYvpBibles,
  parseYvpVerses,
  validBibleId,
  validChapter,
} from './bibleSources'
import { bookNames } from '../src/lib/scripture'
import { bookOrder } from './bibleSources'

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body })

describe('books and requests', () => {
  it('keeps the same book order as the scripture reader', () => {
    expect(bookOrder).toEqual(bookNames)
  })
  it('accepts only a known book, a chapter number and a numeric Bible id', () => {
    expect(validChapter('John', '3')).toBe(true)
    expect(validChapter('Johnn', '3')).toBe(false)
    expect(validChapter('John', '0')).toBe(false)
    expect(validChapter('John', '3/../x')).toBe(false)
    expect(validBibleId('143')).toBe(true)
    expect(validBibleId('143/x')).toBe(false)
  })
})
describe('the NET Bible', () => {
  it('reads a chapter into verses', async () => {
    const fetcher = vi.fn(async (_url: string) =>
      ok([
        {
          bookname: 'John',
          chapter: '3',
          verse: '16',
          text: 'For this is the way God loved the world. ',
        },
        { verse: '17', text: 'For God did not send his Son &amp; more' },
      ]),
    )
    const verses = await fetchNetChapter('John', '3', fetcher as never)
    expect(verses).toEqual([
      { verse: 16, text: 'For this is the way God loved the world.' },
      { verse: 17, text: 'For God did not send his Son & more' },
    ])
    expect(fetcher.mock.calls[0][0]).toContain('passage=John%203')
  })
})
describe('YouVersion', () => {
  it('lists the Bibles this key is licensed for, following pages', async () => {
    const pages = [
      {
        data: [{ id: 111, abbreviation: 'NIV', title: 'New International Version' }],
        next_page_token: 't2',
      },
      { data: [{ id: 143, abbreviation: 'NASB', title: 'New American Standard' }] },
    ]
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => ok(pages.shift()))
    const bibles = await listYvpBibles('key', fetcher as never)
    expect(bibles.map((b) => b.id)).toEqual(['111', '143'])
    expect(fetcher.mock.calls[0][0]).toContain('language_ranges[]=eng')
    expect(fetcher.mock.calls[1][0]).toContain('page_token=t2')
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ 'X-YVP-App-Key': 'key' })
  })
  it('splits chapter markup into verses', () => {
    const html =
      '<p><span class="yv-vlbl">1</span>In the beginning &amp; then <span class="yv-vlbl">2</span>the earth was formless.</p>'
    expect(parseYvpVerses(html)).toEqual([
      { verse: 1, text: 'In the beginning & then' },
      { verse: 2, text: 'the earth was formless.' },
    ])
    expect(parseYvpVerses('<span v="3"></span> hello <sup>4</sup> world')).toEqual([
      { verse: 3, text: 'hello' },
      { verse: 4, text: 'world' },
    ])
  })
  it('says so when the text has no verse numbers', () => {
    expect(() => parseYvpVerses('<p>Just words</p>')).toThrow('verse numbers')
  })
  it('asks for one chapter by its USFM address, and treats a missing chapter as empty', async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
      ok({ content: '<span class="yv-vlbl">16</span>For God so loved' }),
    )
    expect(await fetchYvpChapter('k', '111', 'John', '3', fetcher as never)).toEqual([
      { verse: 16, text: 'For God so loved' },
    ])
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://api.youversion.com/v1/bibles/111/passages/JHN.3?format=html',
    )
    const missing = async () => ({ ok: false, status: 404 })
    expect(await fetchYvpChapter('k', '111', 'John', '3', missing as never)).toEqual([])
  })
})
