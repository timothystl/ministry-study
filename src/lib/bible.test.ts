import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bookNumber,
  clearBibleCache,
  defaultVersionIds,
  loadChapter,
  loadBibliaVersions,
  loadYvpVersions,
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
describe('versions read through the server', () => {
  const json = (body: unknown, status = 200) => ({
    ok: status < 400,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  })
  it('asks the server for the NET Bible and YouVersion chapters', async () => {
    const fetcher = vi.fn(async (_url: string) => json({ verses: [{ verse: 1, text: 'x' }] }))
    vi.stubGlobal('fetch', fetcher)
    await loadChapter('net', '1 John', 4)
    await loadChapter('yvp:111', 'John', 3)
    expect(fetcher.mock.calls[0][0]).toBe('/api/net?book=1%20John&chapter=4')
    expect(fetcher.mock.calls[1][0]).toBe('/api/yvp/passage?bible=111&book=John&chapter=3')
  })
  it('shows the server’s reason when a version is not available', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: 'The ESV is not set up yet.' }, 503)),
    )
    await expect(loadChapter('esv', 'John', 3)).rejects.toThrow('not set up')
  })
  it('turns YouVersion’s list into versions, and gives none when it is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({ bibles: [{ id: '111', abbreviation: 'NIV', title: 'New International Version' }] }),
      ),
    )
    expect(await loadYvpVersions()).toMatchObject([
      { id: 'yvp:111', short: 'NIV', language: 'English' },
    ])
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({}, 500)),
    )
    expect(await loadYvpVersions()).toEqual([])
  })
})
describe('Biblia', () => {
  const json = (body: unknown, status = 200) => ({
    ok: status < 400,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  })
  it('offers the Hebrew, Greek and English Bibles the key can read, and reads a chapter', async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.startsWith('/api/biblia/bibles')
        ? json({
            bibles: [
              {
                id: 'LEB',
                title: 'Lexham',
                short: 'LEB',
                language: 'English',
                copyright: '© Logos',
              },
              { id: 'WLC', title: 'Leningrad', short: 'WLC', language: 'Hebrew', copyright: '' },
              { id: 'DE', title: 'Luther', short: 'LUT', language: 'Other', copyright: '' },
            ],
          })
        : json({ verses: [{ verse: 1, text: 'x' }] }),
    )
    vi.stubGlobal('fetch', fetcher)
    const found = await loadBibliaVersions()
    expect(found.map((v) => [v.id, v.language, v.rtl ?? false])).toEqual([
      ['biblia:LEB', 'English', false],
      ['biblia:WLC', 'Hebrew', true],
    ])
    expect(found[0].credit).toBe('© Logos')
    await loadChapter('biblia:LEB', 'John', 3)
    expect(fetcher.mock.calls[1][0]).toBe('/api/biblia/passage?bible=LEB&book=John&chapter=3')
  })
  it('gives none when Biblia is not set up', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({}, 500)),
    )
    expect(await loadBibliaVersions()).toEqual([])
  })
})
describe('bundled Greek editions', () => {
  it('reads a chapter from the book file and keeps the file', async () => {
    const fetcher = vi.fn(async (_url: string) => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ '3': { '17': 'b', '16': 'a' } }),
    }))
    vi.stubGlobal('fetch', fetcher)
    expect(await loadChapter('sblgnt', 'John', 3)).toEqual([
      { verse: 16, text: 'a' },
      { verse: 17, text: 'b' },
    ])
    expect(await loadChapter('sblgnt', 'John', 4)).toEqual([])
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toBe('/data/greek/sblgnt/43.json')
  })
  it('reads the Lexham English Bible from its own folder, for either testament', async () => {
    const fetcher = vi.fn(async (_url: string) => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        '23': { '1': 'Yahweh⟦1⟧ is my shepherd' },
        _notes: { '23:1': ['Or “the LORD”'] },
      }),
    }))
    vi.stubGlobal('fetch', fetcher)
    expect(await loadChapter('leb', 'Psalms', 23)).toEqual([
      { verse: 1, text: 'Yahweh⟦1⟧ is my shepherd', notes: ['Or “the LORD”'] },
    ])
    expect(fetcher.mock.calls[0][0]).toBe('/data/english/leb/19.json')
    expect(versionsFor('OT').some((v) => v.id === 'leb')).toBe(true)
    expect(versionsFor('NT').some((v) => v.id === 'leb')).toBe(true)
  })
  it('offers the three editions for the New Testament only', () => {
    for (const id of ['sblgnt', 'thgnt', 'na28']) {
      expect(versionsFor('NT').some((v) => v.id === id)).toBe(true)
      expect(versionsFor('OT').some((v) => v.id === id)).toBe(false)
    }
  })
})
describe('Hebrew word study', () => {
  it('reads a chapter of words and joins each verse into text', async () => {
    const fetcher = vi.fn(async (_url: string) => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        '1': {
          '1': [
            ['בְּ/רֵאשִׁית', 'x', 'in/ beginning', 'H9003/{H7225G}', 'HR/Ncfsa'],
            ['בָּרָא', 'y', 'he created', '{H1254A}', 'HVqp3ms'],
          ],
        },
      }),
    }))
    vi.stubGlobal('fetch', fetcher)
    const [verse] = await loadChapter('tahot', 'Genesis', 1)
    expect(verse.text).toBe('בְּרֵאשִׁית בָּרָא')
    expect(verse.study).toHaveLength(2)
    expect(fetcher.mock.calls[0][0]).toBe('/data/hebrew/1.json')
  })
})
describe('Greek word study', () => {
  it('reads a chapter of words and joins each verse into text', async () => {
    const fetcher = vi.fn(async (_url: string) => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        '3': {
          '16': [
            ['οὕτως', 'houtōs', 'Thus', 'G3779', 'ADV', 'οὕτω, οὕτως=thus(-ly)'],
            ['γὰρ', 'gar', 'for', 'G1063', 'CONJ', 'γάρ=for'],
          ],
        },
      }),
    }))
    vi.stubGlobal('fetch', fetcher)
    const [verse] = await loadChapter('nawords', 'John', 3)
    expect(verse.text).toBe('οὕτως γὰρ')
    expect(verse.study?.[0].parts[0]).toMatchObject({ number: 'G3779', lemma: 'οὕτω, οὕτως' })
    expect(fetcher.mock.calls[0][0]).toBe('/data/greek-words/43.json')
  })
})
