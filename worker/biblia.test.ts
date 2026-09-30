import { describe, expect, it, vi } from 'vitest'
import { fetchBibliaChapter, listBibliaBibles, splitBibliaVerses, validBibliaId } from './biblia'

describe('Biblia', () => {
  it('accepts only plain Bible ids', () => {
    expect(validBibliaId('LEB')).toBe(true)
    expect(validBibliaId('logos-lxx.2')).toBe(true)
    expect(validBibliaId('LEB/../x')).toBe(false)
    expect(validBibliaId('')).toBe(false)
  })
  it('lists the Bibles a key can read, sorting them by language', async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({
        bibles: [
          {
            bible: 'LEB',
            title: 'Lexham English Bible',
            abbreviatedTitle: 'LEB',
            languages: ['English'],
            copyright: '<p>Copyright 2012 <b>Logos</b></p>',
          },
          { bible: 'LXX', title: 'Septuagint', languages: ['Greek'] },
          { bible: 'WLC', title: 'Leningrad', languages: ['hbo'] },
          { bible: 'bad/id', title: 'x' },
        ],
      }),
    }))
    const bibles = await listBibliaBibles('secret', fetcher as never)
    expect(bibles.map((b) => [b.id, b.language])).toEqual([
      ['LEB', 'English'],
      ['LXX', 'Greek'],
      ['WLC', 'Hebrew'],
    ])
    expect(bibles[0].copyright).toBe('Copyright 2012 Logos')
    expect(fetcher.mock.calls[0][0]).toContain('key=secret')
  })
  it('splits a chapter back into verses', () => {
    expect(splitBibliaVerses('@@1@@In the beginning\n @@2@@The <i>earth</i> was')).toEqual([
      { verse: 1, text: 'In the beginning' },
      { verse: 2, text: 'The earth was' },
    ])
    expect(splitBibliaVerses('')).toEqual([])
  })
  it('asks for one chapter, and treats a missing one as empty', async () => {
    const fetcher = vi.fn(async (_url: string) => ({
      ok: true,
      status: 200,
      text: async () => '@@16@@For God so loved the world',
    }))
    expect(await fetchBibliaChapter('k', 'LEB', 'John', '3', fetcher as never)).toEqual([
      { verse: 16, text: 'For God so loved the world' },
    ])
    const url = new URL(fetcher.mock.calls[0][0])
    expect(url.pathname).toBe('/v1/bible/content/LEB.txt')
    expect(url.searchParams.get('passage')).toBe('John 3')
    expect(
      await fetchBibliaChapter('k', 'LEB', 'John', '3', (async () => ({
        ok: false,
        status: 404,
      })) as never),
    ).toEqual([])
  })
})
