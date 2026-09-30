// Faithlife's Biblia service (api.biblia.com) gives access to the Bibles in the pastor's Logos library that
// Faithlife makes available to the study's key. The key (BIBLIA_API_KEY) stays on the server.
const API = 'https://api.biblia.com/v1/bible'

export interface BibliaBible {
  id: string
  title: string
  short: string
  language: 'Hebrew' | 'Greek' | 'English' | 'Other'
  copyright: string
}
export const validBibliaId = (id: string) => /^[A-Za-z0-9._-]{1,60}$/.test(id)
const languageOf = (languages: string[]): BibliaBible['language'] => {
  const text = languages.join(' ')
  if (/\b(hebrew|heb|hbo|he)\b/i.test(text)) return 'Hebrew'
  if (/\b(greek|grc|ell|el|gre)\b/i.test(text)) return 'Greek'
  if (/\b(english|eng|en)\b/i.test(text)) return 'English'
  return 'Other'
}
const plain = (text: string) =>
  text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Every Bible the key can read.
export async function listBibliaBibles(
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<BibliaBible[]> {
  const response = await fetcher(`${API}/find?key=${encodeURIComponent(key)}`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`Biblia answered ${response.status}.`)
  const body = (await response.json()) as {
    bibles?: {
      bible?: string
      title?: string
      abbreviatedTitle?: string
      languages?: string[]
      copyright?: string
    }[]
  }
  return (body.bibles ?? [])
    .filter((b) => b.bible && validBibliaId(b.bible))
    .map((b) => ({
      id: b.bible as string,
      title: b.title || (b.bible as string),
      short: b.abbreviatedTitle || (b.bible as string),
      language: languageOf(b.languages ?? []),
      copyright: plain(b.copyright ?? ''),
    }))
}

// One chapter, asked for with a marker in front of each verse so it can be split back into verses.
export function splitBibliaVerses(text: string): { verse: number; text: string }[] {
  const parts = text.split(/@@(\d+)@@/)
  const verses: { verse: number; text: string }[] = []
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const words = plain(parts[i + 1])
    if (words) verses.push({ verse: Number(parts[i]), text: words })
  }
  return verses
}
export async function fetchBibliaChapter(
  key: string,
  bible: string,
  book: string,
  chapter: string,
  fetcher: typeof fetch = fetch,
): Promise<{ verse: number; text: string }[]> {
  const params = new URLSearchParams({
    passage: `${book} ${chapter}`,
    key,
    formatting: 'none',
    redLetter: 'false',
    paragraphs: 'false',
    eachVerse: '@@[VerseNum]@@[VerseText]',
  })
  const response = await fetcher(`${API}/content/${bible}.txt?${params}`)
  if (response.status === 404) return []
  if (!response.ok) throw new Error(`Biblia answered ${response.status}.`)
  return splitBibliaVerses(await response.text())
}
