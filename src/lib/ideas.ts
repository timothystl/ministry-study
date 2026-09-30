import { blankNote, type Note } from './notes'

// Places to look for illustrations and ideas. The study never copies their pages: it opens a search
// limited to that site, and an item saved from one keeps the link and the pastor's own note.
export interface IdeaSource {
  name: string
  site: string // domain, or domain/path, the search is limited to
}
export const builtInSources: IdeaSource[] = [
  { name: 'TextWeek', site: 'textweek.com' },
  { name: 'The Salt Project', site: 'saltproject.org' },
  { name: 'RW360', site: 'rw360.org' },
  { name: 'Cardiphonia', site: 'cardiphonia.wordpress.com' },
]
export const searchUrl = (source: IdeaSource, query: string) =>
  `https://duckduckgo.com/?q=${encodeURIComponent(`site:${source.site} ${query}`.trim())}`
export const homeUrl = (source: IdeaSource) => `https://${source.site}/`

export const isWebLink = (text: string) => /^https?:\/\/[^\s]+$/i.test(text.trim())
// "https://rw360.org/blog/the-lost-son-again/" becomes "The lost son again", filed under "rw360.org".
export function linkTitle(url: string): { title: string; site: string } {
  const u = new URL(url.trim())
  const site = u.hostname.replace(/^www\./, '')
  const slug = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '')
    .replace(/\.(html?|php|aspx?)$/i, '')
    .replace(/[-_+]+/g, ' ')
    .trim()
  const title = slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : site
  return { title, site }
}
export function noteFromLink(url: string, comment = ''): Note {
  const { title, site } = linkTitle(url)
  return {
    ...blankNote('Illustration'),
    title,
    body: comment.trim(),
    source: url.trim(),
    tags: [site],
    updatedAt: new Date().toISOString(),
  }
}
// One link per line, optionally followed by "|" and a note: "https://… | good for Lent 3".
export function parseLinks(text: string, existing: Note[]): { ready: Note[]; skipped: string[] } {
  const have = new Set(existing.map((n) => n.source.trim().toLowerCase()))
  const ready: Note[] = []
  const skipped: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const [link, ...rest] = line.split('|')
    const url = link.trim()
    if (!url) continue
    if (!isWebLink(url)) skipped.push(`${url.slice(0, 80)}: not a web link`)
    else if (have.has(url.toLowerCase()) || ready.some((n) => n.source === url))
      skipped.push(`${url.slice(0, 80)}: already collected`)
    else ready.push(noteFromLink(url, rest.join('|')))
  }
  return { ready, skipped }
}
