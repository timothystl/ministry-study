import type { Attachment } from './attachments'
import type { HymnFile } from './hymns'
import type { Library } from './model'

// Music resources: the artists, albums, articles, books, songbooks and sites where hymns and songs
// are found. A resource keeps its link, notes, tags, where a local copy is kept, and any photos or
// PDFs attached to it.
export const resourceKinds = [
  'Artist',
  'Album',
  'Article',
  'Book',
  'Songbook',
  'Website',
  'Other',
] as const
export type ResourceKind = (typeof resourceKinds)[number]
export interface Resource {
  id: string
  title: string
  kind: ResourceKind
  creator: string // artist, author or producer
  year: string
  place: string
  link: string
  notes: string
  tags: string[]
  files: HymnFile[] // copies kept in your own files
  attachments: Attachment[]
  source: string
  sourceId: string
  updatedAt: string
}
export const blankResource = (kind: ResourceKind = 'Album'): Resource => ({
  id: crypto.randomUUID(),
  title: '',
  kind,
  creator: '',
  year: '',
  place: '',
  link: '',
  notes: '',
  tags: [],
  files: [],
  attachments: [],
  source: '',
  sourceId: '',
  updatedAt: '',
})
const isUrl = (v: string) => /^https?:\/\/\S+$/i.test(v.trim())
const list = (v: string[]) => v.map((x) => x.trim()).filter(Boolean)
export function saveResource(library: Library, resource: Resource): Library {
  const title = resource.title.trim()
  if (!title) throw new Error('A resource needs a title.')
  if (resource.year.trim() && !/^\d{4}$/.test(resource.year.trim()))
    throw new Error('Use a four-digit year.')
  if (resource.link.trim() && !isUrl(resource.link))
    throw new Error(`“${resource.link.trim()}” is not a web address.`)
  const saved: Resource = {
    ...resource,
    title,
    year: resource.year.trim(),
    link: resource.link.trim(),
    tags: list(resource.tags),
    files: resource.files
      .filter((f) => f.location.trim())
      .map((f) => ({ ...f, location: f.location.trim() })),
    updatedAt: new Date().toISOString(),
  }
  const exists = library.resources.some((r) => r.id === resource.id)
  return {
    ...library,
    resources: exists
      ? library.resources.map((r) => (r.id === resource.id ? saved : r))
      : [...library.resources, saved],
  }
}
export const deleteResource = (library: Library, id: string): Library => ({
  ...library,
  resources: library.resources.filter((r) => r.id !== id),
})
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
export const sortResources = (items: Resource[]) =>
  [...items].sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }))
export const allTags = (items: Resource[]) =>
  [...new Set(items.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b))
export interface ResourceFilters {
  kind?: string
  tag?: string
}
export function searchResources(
  items: Resource[],
  query: string,
  filters: ResourceFilters = {},
): Resource[] {
  const pool = sortResources(items).filter(
    (r) =>
      (!filters.kind || r.kind === filters.kind) && (!filters.tag || r.tags.includes(filters.tag)),
  )
  const words = normalize(query).split(' ').filter(Boolean)
  if (!words.length) return pool
  return pool.filter((r) => {
    const text = normalize(
      [r.title, r.kind, r.creator, r.year, r.place, r.notes, r.tags.join(' ')].join(' '),
    )
    return words.every((w) => text.includes(w))
  })
}

// The bundled Retuned Hymn Movement list (artists, albums, articles and books).
export interface BundledResource {
  id: string
  kind: ResourceKind
  title: string
  creator: string
  year: string
  place: string
  link: string
  notes: string
  tags: string[]
}
export const BUNDLE_SOURCE = 'Retuned Hymn Movement list'
export function resourcesFromBundle(
  entries: BundledResource[],
  library: Library,
): { resources: Resource[]; skipped: number } {
  const have = new Set(
    library.resources.filter((r) => r.source === BUNDLE_SOURCE).map((r) => r.sourceId),
  )
  const resources: Resource[] = []
  let skipped = 0
  for (const e of entries) {
    if (have.has(e.id)) {
      skipped++
      continue
    }
    resources.push({
      ...blankResource(e.kind),
      id: `retuned-${e.id}`,
      title: e.title,
      creator: e.creator,
      year: e.year,
      place: e.place,
      link: e.link,
      notes: e.notes,
      tags: e.tags,
      source: BUNDLE_SOURCE,
      sourceId: e.id,
      updatedAt: new Date().toISOString(),
    })
  }
  return { resources, skipped }
}
