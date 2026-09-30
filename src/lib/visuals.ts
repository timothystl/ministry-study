import type { Attachment } from './attachments'
import { linkTitle } from './ideas'
import type { Library } from './model'
import { parseReferences, referencesOverlap } from './scripture'
import type { Sermon } from './sermons'

// Images and clips kept for reference: where they are, who made them, what the license allows, and
// for a clip the moment that matters. The study stores only small reference photos; a better image
// or a video is linked, and a clip is played from its own site, so nothing here copies a film.
export const visualKinds = [
  'Photo',
  'Painting or art',
  'Graphic',
  'Slide background',
  'Clip',
] as const
export type VisualKind = (typeof visualKinds)[number]
export const licenses = [
  'Public domain',
  'Creative Commons',
  'CVLI (church license)',
  'Own work',
  'Reference only',
  'Unknown',
] as const
export type License = (typeof licenses)[number]
export const useForOptions = [
  'Sermon slide',
  'Bulletin',
  'Chapel',
  'Pre-K',
  'Website',
  'Worship background',
] as const
// Reference only and Unknown are not cleared to show in worship, on a slide or in print.
export const isCleared = (license: string) => license !== 'Reference only' && license !== 'Unknown'

export interface Visual {
  id: string
  title: string
  kind: VisualKind
  link: string // where the image or video is (the better copy lives there)
  creator: string
  license: License
  credit: string // attribution text, ready to paste onto a slide
  scripture: string
  tags: string[]
  useFor: string[]
  notes: string // why it is worth keeping
  start: string // clips: m:ss or h:mm:ss
  end: string
  happens: string // clips: what happens in the scene
  contentNote: string // clips: language, violence, age suitability
  noteId: string // an illustration this belongs with
  attachments: Attachment[] // small reference photos
  personal: boolean
  updatedAt: string
}
export const blankVisual = (kind: VisualKind = 'Photo'): Visual => ({
  id: crypto.randomUUID(),
  title: '',
  kind,
  link: '',
  creator: '',
  license: 'Unknown',
  credit: '',
  scripture: '',
  tags: [],
  useFor: [],
  notes: '',
  start: '',
  end: '',
  happens: '',
  contentNote: '',
  noteId: '',
  attachments: [],
  personal: false,
  updatedAt: '',
})

// "1:05" is 65 seconds, "1:02:03" is 3,723; anything else is not a time.
export function seconds(text: string): number | null {
  const t = text.trim()
  if (!t) return null
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(t) ?? /^()(\d+):(\d{2})$/.exec(t)
  if (!m) return /^\d+$/.test(t) ? Number(t) : null
  return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3])
}
export const isWebLink = (text: string) => /^https?:\/\/[^\s]+$/i.test(text.trim())

export interface Video {
  site: 'YouTube' | 'Vimeo'
  id: string
}
export function parseVideo(link: string): Video | null {
  let u: URL
  try {
    u = new URL(link.trim())
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')
  const yt = /^[A-Za-z0-9_-]{11}$/
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0]
    return yt.test(id) ? { site: 'YouTube', id } : null
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = u.searchParams.get('v')
    if (v && yt.test(v)) return { site: 'YouTube', id: v }
    const m = /^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/.exec(u.pathname)
    return m ? { site: 'YouTube', id: m[1] } : null
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = /(?:^|\/)(\d{6,})(?:\/|$)/.exec(u.pathname)
    return m ? { site: 'Vimeo', id: m[1] } : null
  }
  return null
}
// The clip's own start and end are honored by the player, so it opens at the right moment.
export function embedUrl(v: Video, start: string, end: string): string {
  const s = seconds(start)
  const e = seconds(end)
  if (v.site === 'Vimeo') return `https://player.vimeo.com/video/${v.id}${s ? `#t=${s}s` : ''}`
  const params = new URLSearchParams({ rel: '0' })
  if (s) params.set('start', String(s))
  if (e) params.set('end', String(e))
  return `https://www.youtube-nocookie.com/embed/${v.id}?${params}`
}
export const thumbnailUrl = (v: Video) =>
  v.site === 'YouTube' ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` : ''

// “Title” by Creator, license. Link — ready to paste onto a slide or into a bulletin.
export function creditLine(v: Visual): string {
  if (v.credit.trim()) return v.credit.trim()
  const by = v.creator.trim() ? ` by ${v.creator.trim()}` : ''
  const lic = v.license === 'Unknown' || v.license === 'Reference only' ? '' : `, ${v.license}`
  const link = v.link.trim() ? ` ${v.link.trim()}` : ''
  return `“${v.title}”${by}${lic}.${link}`.trim()
}

export function saveVisual(library: Library, visual: Visual): Library {
  const link = visual.link.trim()
  if (link && !isWebLink(link)) throw new Error('The link should start with http:// or https://.')
  const s = seconds(visual.start)
  const e = seconds(visual.end)
  if (visual.start.trim() && s === null)
    throw new Error('Write the start as minutes:seconds, such as 1:05.')
  if (visual.end.trim() && e === null)
    throw new Error('Write the end as minutes:seconds, such as 2:30.')
  if (s !== null && e !== null && e <= s) throw new Error('The end must come after the start.')
  const title = visual.title.trim() || (link ? linkTitle(link).title : '') || visual.creator.trim()
  if (!title && !visual.attachments.length) throw new Error('Give it a title, a link or a photo.')
  const saved: Visual = {
    ...visual,
    title: title || `Image ${new Date().toISOString().slice(0, 10)}`,
    link,
    tags: visual.tags.map((t) => t.trim()).filter(Boolean),
    updatedAt: new Date().toISOString(),
  }
  const exists = library.visuals.some((x) => x.id === visual.id)
  return {
    ...library,
    visuals: exists
      ? library.visuals.map((x) => (x.id === visual.id ? saved : x))
      : [...library.visuals, saved],
  }
}
export const deleteVisual = (library: Library, id: string): Library => ({
  ...library,
  visuals: library.visuals.filter((v) => v.id !== id),
})
// A pasted link becomes a starting record: a clip if it is a video site, otherwise a photo.
export function visualFromLink(link: string): Visual {
  const video = parseVideo(link)
  return {
    ...blankVisual(video ? 'Clip' : 'Photo'),
    title: video ? '' : linkTitle(link).title,
    link: link.trim(),
    updatedAt: new Date().toISOString(),
  }
}

export interface VisualFilters {
  kind?: string
  license?: string
  useFor?: string
}
export interface VisualHit {
  visual: Visual
  reasons: string[]
}
const newest = (a: Visual, b: Visual) =>
  b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title)
export function searchVisuals(
  list: Visual[],
  query: string,
  filters: VisualFilters = {},
): VisualHit[] {
  const pool = [...list]
    .sort(newest)
    .filter(
      (v) =>
        (!filters.kind || v.kind === filters.kind) &&
        (!filters.license || v.license === filters.license) &&
        (!filters.useFor || v.useFor.includes(filters.useFor)),
    )
  const q = query.trim().toLowerCase()
  if (!q) return pool.map((visual) => ({ visual, reasons: [] }))
  const parsed = parseReferences(query)
  const words = q.split(/\s+/)
  const hits: VisualHit[] = []
  for (const visual of pool) {
    const reasons: string[] = []
    if (parsed.complete && referencesOverlap(parsed.refs, parseReferences(visual.scripture).refs))
      reasons.push('Passage')
    const text = [
      visual.title,
      visual.kind,
      visual.creator,
      visual.license,
      visual.credit,
      visual.scripture,
      visual.tags.join(' '),
      visual.useFor.join(' '),
      visual.notes,
      visual.happens,
      visual.link,
    ]
      .join(' \n ')
      .toLowerCase()
    if (words.every((w) => text.includes(w))) reasons.push('Text')
    if (reasons.length) hits.push({ visual, reasons })
  }
  return hits
}
// Images and clips for a sermon's passage.
export function visualsForSermon(library: Library, sermon: Sermon): Visual[] {
  const refs = parseReferences(sermon.scripture).refs
  return refs.length
    ? library.visuals
        .filter((v) => referencesOverlap(refs, parseReferences(v.scripture).refs))
        .sort(newest)
    : []
}

// Places to look for images and clips. Each opens a search in a new tab; nothing is copied.
export interface VisualSource {
  name: string
  url: (query: string) => string
  note: string
}
const q = encodeURIComponent
const onSite = (site: string) => (query: string) =>
  `https://duckduckgo.com/?q=${q(`site:${site} ${query}`.trim())}`
export const visualSources: VisualSource[] = [
  {
    name: 'Wikimedia Commons',
    url: (s) => `https://commons.wikimedia.org/w/index.php?search=${q(s)}&ns6=1`,
    note: 'Each file states its license',
  },
  {
    name: 'The Met (open access)',
    url: onSite('metmuseum.org/art/collection'),
    note: 'Public domain art',
  },
  { name: 'National Gallery of Art', url: onSite('nga.gov'), note: 'Open access images' },
  {
    name: 'Library of Congress',
    url: onSite('loc.gov/pictures'),
    note: 'Check each rights statement',
  },
  {
    name: 'Unsplash',
    url: (s) => `https://unsplash.com/s/photos/${q(s)}`,
    note: 'Free-use photos',
  },
  {
    name: 'Pexels',
    url: (s) => `https://www.pexels.com/search/${q(s)}/`,
    note: 'Free-use photos and video',
  },
  {
    name: 'YouTube',
    url: (s) => `https://www.youtube.com/results?search_query=${q(s)}`,
    note: 'For clips: paste the link back here',
  },
]
