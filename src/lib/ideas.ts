import { blankNote, type Note } from './notes'

// Places to look for illustrations and ideas. The study never copies their pages: it opens a search
// limited to that site, and an item saved from one keeps the link and the pastor's own note.
export interface IdeaSource {
  id: string
  name: string
  site: string // domain, or domain/path, the search is limited to
}
export const builtInSources: IdeaSource[] = [
  { id: 'textweek', name: 'TextWeek', site: 'textweek.com' },
  { id: 'saltproject', name: 'The Salt Project', site: 'saltproject.org' },
  { id: 'rw360', name: 'RW360', site: 'rw360.org' },
  { id: 'cardiphonia', name: 'Cardiphonia', site: 'cardiphonia.wordpress.com' },
  { id: 'workingpreacher', name: 'Working Preacher', site: 'workingpreacher.org' },
  { id: 'christiancentury', name: 'Christian Century', site: 'christiancentury.org' },
  { id: 'sojourners', name: 'Sojourners', site: 'sojo.net' },
]
// "https://www.example.org/blog/" becomes "example.org/blog"; anything that is not an address is refused.
export function cleanSite(input: string): string {
  const site = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/[^\s]*)?$/.test(site))
    throw new Error('Enter a web address, such as example.org or example.org/blog.')
  return site
}
export function addSource(list: IdeaSource[], name: string, address: string): IdeaSource[] {
  const site = cleanSite(address)
  const label = name.trim() || site
  if ([...builtInSources, ...list].some((s) => s.site === site))
    throw new Error('That site is already in the list.')
  return [...list, { id: crypto.randomUUID(), name: label, site }]
}
export const allSources = (custom: IdeaSource[]) => [...builtInSources, ...custom]
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
