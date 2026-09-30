// The ESV comes from Crossway's own service (api.esv.org), which needs the study's API key. The key
// stays on the server (ESV_API_KEY); the browser only ever asks this Worker for a chapter.
export const ESV_COPYRIGHT =
  'Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.'
const ESV_URL = 'https://api.esv.org/v3/passage/text/'

export interface EsvVerse {
  verse: number
  text: string
}
// "[1] In the beginning… [2] The earth was…" into one entry per verse.
export function splitVerses(text: string): EsvVerse[] {
  const parts = text.split(/\[(\d+)\]/)
  const verses: EsvVerse[] = []
  for (let i = 1; i + 1 < parts.length; i += 2)
    verses.push({ verse: Number(parts[i]), text: parts[i + 1].replace(/\s+/g, ' ').trim() })
  return verses
}
export const validEsvReference = (q: string) =>
  /^(?:[1-3] )?[A-Za-z]+(?: of [A-Za-z]+)? \d{1,3}$/.test(q)

export async function fetchEsvChapter(
  reference: string,
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<EsvVerse[]> {
  const params = new URLSearchParams({
    q: reference,
    'include-passage-references': 'false',
    'include-verse-numbers': 'true',
    'include-first-verse-numbers': 'true',
    'include-footnotes': 'false',
    'include-footnote-body': 'false',
    'include-headings': 'false',
    'include-short-copyright': 'false',
    'include-selahs': 'true',
    'indent-poetry': 'false',
    'line-length': '0',
  })
  const response = await fetcher(`${ESV_URL}?${params}`, {
    headers: { Authorization: `Token ${key}`, Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`The ESV service answered ${response.status}.`)
  const body = (await response.json()) as { passages?: string[] }
  return splitVerses(body.passages?.[0] ?? '')
}
