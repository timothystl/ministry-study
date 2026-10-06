import { blankNote, saveNote, sortNotes, type Note } from './notes'
import type { Book, Library } from './model'
import { isPrivateOccasion, sortSermons, type Sermon } from './sermons'
import type { Hymn } from './hymns'
import { parseReferences, referencesOverlap } from './scripture'

// Research a Text: everything already in the study that touches one passage, so the pastor starts
// from what is on the shelf and in the files before looking outside.
export const observationKinds = ['Sermon note', 'Study note'] as const
export type ObservationKind = (typeof observationKinds)[number]
export const observationLabel = (kind: string) => (kind === 'Study note' ? 'Bible class' : 'Sermon')

export interface Material {
  sermons: Sermon[]
  notes: Note[] // devotions, study notes, illustrations and ideas on the passage
  hymns: Hymn[]
  commentaries: Book[]
  teaching: Book[]
}
const none: Material = { sermons: [], notes: [], hymns: [], commentaries: [], teaching: [] }
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
const bookText = (b: Book) =>
  [b.title, b.subtitle ?? '', b.topics.join(' '), (b.useFor ?? []).join(' ')].join(' \n ')

// Library books about a Bible book: a commentary when it says so, otherwise teaching and study.
export function booksAbout(books: Book[], bibleBook: string) {
  const name = new RegExp(String.raw`\b${escape(bibleBook).replace(/ /g, String.raw`\s+`)}\b`, 'i')
  const about = books.filter((b) => name.test(bookText(b)))
  const isCommentary = (b: Book) => /commentar/i.test(bookText(b))
  const owned = (a: Book, b: Book) =>
    Number(b.ownership === 'Owned') - Number(a.ownership === 'Owned') ||
    a.title.localeCompare(b.title)
  return {
    commentaries: about.filter(isCommentary).sort(owned),
    teaching: about.filter((b) => !isCommentary(b)).sort(owned),
  }
}

// Funerals and weddings, and notes marked personal, never turn up on their own.
export function materialFor(library: Library, passage: string): Material & { complete: boolean } {
  const parsed = parseReferences(passage)
  if (!parsed.refs.length) return { ...none, complete: false }
  const on = (scripture: string) => referencesOverlap(parsed.refs, parseReferences(scripture).refs)
  return {
    complete: parsed.complete,
    sermons: sortSermons(library.sermons.filter((s) => !isPrivateOccasion(s) && on(s.scripture))),
    notes: sortNotes(library.notes.filter((n) => !n.personal && on(n.scripture))),
    hymns: library.hymns.filter((h) => on(h.scripture)),
    ...booksAbout(library.books, parsed.refs[0].book),
  }
}

// What the pastor wrote while studying this passage, to preach or to teach.
export const observationsFor = (library: Library, passage: string) => {
  const refs = parseReferences(passage).refs
  return sortNotes(
    library.notes.filter(
      (n) =>
        (observationKinds as readonly string[]).includes(n.kind) &&
        refs.length > 0 &&
        referencesOverlap(refs, parseReferences(n.scripture).refs),
    ),
  )
}

export function saveObservation(
  library: Library,
  draft: { id?: string; kind: ObservationKind; title: string; body: string; sermonId: string },
  passage: string,
): Library {
  if (!draft.body.trim()) throw new Error('Write something first.')
  const parsed = parseReferences(passage)
  if (!parsed.refs.length)
    throw new Error('Open a passage first, so the note knows where it belongs.')
  const existing = library.notes.find((n) => n.id === draft.id)
  const note: Note = {
    ...(existing ?? blankNote(draft.kind)),
    kind: draft.kind,
    title: draft.title.trim() || `${observationLabel(draft.kind)} notes on ${passage.trim()}`,
    body: draft.body,
    scripture: existing?.scripture || passage.trim(),
    sermonId: draft.sermonId,
  }
  return saveNote(library, note)
}
