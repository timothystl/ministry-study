import type { Attachment } from './attachments'
import type { Library } from './model'
import { parseReferences, referencesOverlap } from './scripture'
import { parseSermonLine, type Sermon } from './sermons'

// Devotions and working notes: council devotions, midweek devotions, sermon-preparation notes,
// illustrations, ideas and study notes. A note can be tied to a sermon and to a passage, so it
// turns up wherever that passage is being worked on. The finished manuscripts live in Sermons.
export const childrenKinds = ["Children's message", 'Chapel message'] as const
export const devotionKinds = ['Devotion', 'Sermon note', 'Study note'] as const
// The collector: stories, quotes, images, facts, half-ideas and photographed scraps.
export const ideaKinds = ['Illustration', 'Idea', 'Quote', 'Story', 'Fact', 'Scrap'] as const
export const noteKinds = [...devotionKinds, ...ideaKinds, ...childrenKinds] as const
export const MAX_NOTE = 30_000
export interface Note {
  id: string
  title: string
  kind: (typeof noteKinds)[number]
  body: string
  scripture: string
  date: string
  sermonId: string
  tags: string[]
  source: string // an import's file name, or for a collected item where it came from
  attachments: Attachment[] // photos of handwritten scraps, pages and the like
  uses: string[] // where it has been used, newest last: "2026-03-08 The Lost Son"
  personal: boolean // pastoral or private: marked so it is never shared by mistake
  updatedAt: string
}
export const isChildrensKind = (kind: string) => (childrenKinds as readonly string[]).includes(kind)
export const isIdeaKind = (kind: string) => (ideaKinds as readonly string[]).includes(kind)
export const blankNote = (kind: Note['kind'] = 'Devotion'): Note => ({
  id: crypto.randomUUID(),
  title: '',
  kind,
  body: '',
  scripture: '',
  date: '',
  sermonId: '',
  tags: [],
  source: '',
  attachments: [],
  uses: [],
  personal: false,
  updatedAt: '',
})
export function saveNote(library: Library, note: Note): Library {
  if (!note.title.trim() && !note.body.trim() && !note.attachments.length)
    throw new Error('A note needs a title, some text or a photo.')
  if (note.body.length > MAX_NOTE)
    throw new Error(
      `This is longer than ${MAX_NOTE.toLocaleString()} characters. A finished sermon belongs in Sermons → Manuscripts.`,
    )
  if (note.date && !/^\d{4}-\d{2}-\d{2}$/.test(note.date)) throw new Error('Use a valid date.')
  const saved: Note = {
    ...note,
    title:
      note.title.trim() ||
      note.body.trim().split('\n')[0].slice(0, 80) ||
      `Scrap ${new Date().toISOString().slice(0, 10)}`,
    body: note.body.trim(),
    tags: note.tags.map((t) => t.trim()).filter(Boolean),
    uses: note.uses.map((u) => u.trim()).filter(Boolean),
    updatedAt: new Date().toISOString(),
  }
  const exists = library.notes.some((n) => n.id === note.id)
  return {
    ...library,
    notes: exists
      ? library.notes.map((n) => (n.id === note.id ? saved : n))
      : [...library.notes, saved],
  }
}
export const deleteNote = (library: Library, id: string): Library => ({
  ...library,
  notes: library.notes.filter((n) => n.id !== id),
})
const byNewest = (a: Note, b: Note) =>
  (b.date || b.updatedAt.slice(0, 10)).localeCompare(a.date || a.updatedAt.slice(0, 10)) ||
  a.title.localeCompare(b.title)
export const sortNotes = (notes: Note[]) => [...notes].sort(byNewest)

export interface NoteHit {
  note: Note
  reasons: string[]
}
// Passage searches match by chapter and verse overlap; other searches match every word across the
// title, text, passage, tags and kind. Each result says why it matched.
export function searchNotes(
  notes: Note[],
  query: string,
  kind = '',
  use: '' | 'unused' | 'used' = '',
): NoteHit[] {
  const pool = sortNotes(notes).filter(
    (n) => (!kind || n.kind === kind) && (!use || (use === 'used') === n.uses.length > 0),
  )
  const q = query.trim().toLowerCase()
  if (!q) return pool.map((note) => ({ note, reasons: [] }))
  const parsed = parseReferences(query)
  const words = q.split(/\s+/)
  const hits: NoteHit[] = []
  for (const note of pool) {
    const reasons: string[] = []
    if (parsed.complete && referencesOverlap(parsed.refs, parseReferences(note.scripture).refs))
      reasons.push('Passage')
    const text = [
      note.title,
      note.body,
      note.scripture,
      note.tags.join(' '),
      note.kind,
      note.source,
      note.uses.join(' '),
    ]
      .join(' \n ')
      .toLowerCase()
    if (words.every((w) => text.includes(w))) reasons.push('Text')
    if (reasons.length) hits.push({ note, reasons })
  }
  return hits
}
// Notes for a sermon: those tied to it, and others on an overlapping passage.
export function notesForSermon(library: Library, sermon: Sermon) {
  const linked = sortNotes(library.notes.filter((n) => n.sermonId === sermon.id))
  const refs = parseReferences(sermon.scripture).refs
  const onPassage = refs.length
    ? sortNotes(
        library.notes.filter(
          (n) =>
            n.sermonId !== sermon.id && referencesOverlap(refs, parseReferences(n.scripture).refs),
        ),
      )
    : []
  return { linked, onPassage }
}
// Records where a collected item was used, so it can be set aside or found again.
export function markUsed(note: Note, where: string, date: string): Note {
  const label = [date, where.trim()].filter(Boolean).join(' ')
  if (!label) throw new Error('Say where it was used, or give a date.')
  return { ...note, uses: [...note.uses, label] }
}
// A file becomes a note: the date and passage are read from its name, the rest is its text.
export function noteFromFile(text: string, fileName: string, kind: Note['kind']): Note {
  const row = parseSermonLine(fileName)
  return {
    ...blankNote(),
    title: row.title,
    kind,
    body: text.trim(),
    scripture: row.scripture,
    date: row.date,
    source: `Imported file: ${fileName}`,
    updatedAt: new Date().toISOString(),
  }
}
