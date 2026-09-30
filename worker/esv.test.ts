import { describe, expect, it, vi } from 'vitest'
import { fetchEsvChapter, splitVerses, validEsvReference } from './esv'

describe('the ESV', () => {
  it('splits a chapter into verses', () => {
    expect(
      splitVerses('[1] In the beginning,\n  God created. [2] The earth was\nformless.'),
    ).toEqual([
      { verse: 1, text: 'In the beginning, God created.' },
      { verse: 2, text: 'The earth was formless.' },
    ])
    expect(splitVerses('')).toEqual([])
  })
  it('accepts only a book and chapter', () => {
    for (const ok of ['John 3', '1 Corinthians 13', 'Song of Solomon 2'])
      expect(validEsvReference(ok)).toBe(true)
    for (const bad of ['John', 'John 3:16', 'John 3&q=x', ''])
      expect(validEsvReference(bad)).toBe(false)
  })
  it('sends the key to Crossway and reads the verses', async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ passages: ['[16] For God so loved the world.'] }),
    }))
    const verses = await fetchEsvChapter('John 3', 'secret', fetcher as never)
    expect(verses).toEqual([{ verse: 16, text: 'For God so loved the world.' }])
    expect(fetcher.mock.calls[0][0]).toContain('https://api.esv.org/v3/passage/text/?q=John+3')
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Token secret' })
  })
  it('reports a refusal', async () => {
    const fetcher = async () => ({ ok: false, status: 401 })
    await expect(fetchEsvChapter('John 3', 'bad', fetcher as never)).rejects.toThrow('401')
  })
})
