import type { Library } from './model'
import { searchBooks } from './model'
import { isChildrensKind, isIdeaKind, searchNotes } from './notes'
import { searchPrayers } from './prayers'
import { searchHymns, searchLiturgies, hymnarySearchUrl } from './hymns'
import { allSources, searchUrl } from './ideas'
import { searchResources } from './resources'
import { isPrivateOccasion, searchSermons } from './sermons'
import { searchVisuals } from './visuals'
import { formatReferences, parseReferences } from './scripture'

// The Search page looks across everything in the study at once, and points to outside sources.
export const findScopes = ['Everything', 'My resources', 'Outside resources'] as const
export type FindScope = (typeof findScopes)[number]
export type FindKind =
  | 'sermon'
  | 'note'
  | 'idea'
  | 'children'
  | 'prayer'
  | 'hymn'
  | 'liturgy'
  | 'book'
  | 'resource'
  | 'visual'
  | 'outside'
  | 'passage'
export interface FindResult {
  key: string
  kind: FindKind
  title: string
  detail: string
  action: string
  // Where the button leads: a page of the study, or a web address.
  page?:
    | 'Sermons'
    | 'Notes'
    | 'Ideas'
    | 'Children'
    | 'Prayers'
    | 'Hymns'
    | 'Liturgies'
    | 'Resources'
    | 'Visuals'
    | 'Research'
  openId?: string
  seed?: string
  url?: string
  book?: string
}
const PER_KIND = 6
const text = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ')

export function findMine(library: Library, query: string): FindResult[] {
  const q = query.trim()
  if (!q) return []
  const out: FindResult[] = []
  const passage = parseReferences(q)
  if (passage.complete && passage.refs.length)
    out.push({
      key: 'passage',
      kind: 'passage',
      title: `Research ${formatReferences(passage.refs)}`,
      detail: 'Text, your material, commentaries, hymns and notes',
      action: 'Open passage',
      page: 'Research',
      seed: q,
    })
  // Funerals and weddings, and notes marked personal, never turn up in a search across everything.
  for (const { sermon: s } of searchSermons(library.sermons, q)
    .filter((h) => !isPrivateOccasion(h.sermon))
    .slice(0, PER_KIND))
    out.push({
      key: `sermon-${s.id}`,
      kind: 'sermon',
      title: s.title,
      detail: text('Sermon', s.scripture, s.date.slice(0, 4)),
      action: s.manuscript ? 'Open manuscript' : 'Open sermon',
      page: 'Sermons',
      seed: s.title,
    })
  for (const { note: n } of searchNotes(
    library.notes.filter((x) => !x.personal),
    q,
  ).slice(0, PER_KIND * 2)) {
    const kind: FindKind = isChildrensKind(n.kind)
      ? 'children'
      : isIdeaKind(n.kind)
        ? 'idea'
        : 'note'
    out.push({
      key: `note-${n.id}`,
      kind,
      title: n.title,
      detail: text(n.kind, n.scripture),
      action: kind === 'idea' ? 'Open idea' : kind === 'children' ? 'Open message' : 'Open note',
      page: kind === 'idea' ? 'Ideas' : kind === 'children' ? 'Children' : 'Notes',
      seed: n.title,
    })
  }
  for (const p of searchPrayers(library.prayers, q).slice(0, PER_KIND))
    out.push({
      key: `prayer-${p.id}`,
      kind: 'prayer',
      title: p.title || p.category || 'Prayer',
      detail: text(p.type, p.category),
      action: 'Open prayer',
      page: 'Prayers',
      seed: p.title || q,
    })
  for (const { hymn: h } of searchHymns(library.hymns, q).slice(0, PER_KIND))
    out.push({
      key: `hymn-${h.id}`,
      kind: 'hymn',
      title: h.title,
      detail: text('Hymn', h.hymnal),
      action: 'Open hymn',
      page: 'Hymns',
      openId: h.id,
    })
  for (const l of searchLiturgies(library.liturgies, library.hymns, q).slice(0, PER_KIND))
    out.push({
      key: `liturgy-${l.id}`,
      kind: 'liturgy',
      title: l.title,
      detail: text('Service', l.kind, l.season),
      action: 'Open service',
      page: 'Liturgies',
      openId: l.id,
    })
  for (const b of searchBooks(library, q).slice(0, PER_KIND))
    out.push({
      key: `book-${b.id}`,
      kind: 'book',
      title: b.title,
      detail: text('Book', b.author, b.ownership),
      action: 'Open book',
      book: b.id,
    })
  for (const r of searchResources(library.resources, q).slice(0, PER_KIND))
    out.push({
      key: `resource-${r.id}`,
      kind: 'resource',
      title: r.title,
      detail: text('Music resource', r.kind, r.creator),
      action: 'Open resource',
      page: 'Resources',
      seed: r.title,
    })
  for (const { visual: v } of searchVisuals(library.visuals, q).slice(0, PER_KIND))
    out.push({
      key: `visual-${v.id}`,
      kind: 'visual',
      title: v.title,
      detail: text(v.kind, v.license),
      action: 'Open image',
      page: 'Visuals',
      seed: v.title,
    })
  return out
}

// Free sites, searched from the outside; nothing is copied into the study.
export function findOutside(library: Library, query: string): FindResult[] {
  const q = query.trim()
  if (!q) return []
  return [
    ...allSources(library.ideaSources).map((s) => ({
      key: `outside-${s.id}`,
      kind: 'outside' as const,
      title: s.name,
      detail: 'Free online',
      action: 'Search source',
      url: searchUrl(s, q),
    })),
    {
      key: 'outside-hymnary',
      kind: 'outside' as const,
      title: 'Hymnary',
      detail: 'Music discovery',
      action: 'Search hymns',
      url: hymnarySearchUrl(q),
    },
    {
      key: 'outside-biblegateway',
      kind: 'outside' as const,
      title: 'Bible Gateway',
      detail: 'Bible text and word search',
      action: 'Search Bibles',
      url: `https://www.biblegateway.com/quicksearch/?quicksearch=${encodeURIComponent(q)}`,
    },
  ]
}

export function findAll(library: Library, query: string, scope: FindScope): FindResult[] {
  return [
    ...(scope === 'Outside resources' ? [] : findMine(library, query)),
    ...(scope === 'My resources' ? [] : findOutside(library, query)),
  ]
}
