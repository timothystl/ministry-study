// The parts of the app a person can be given. The pastor (admin) always has every part; for anyone
// else, each part is switched on or off. Every stored record kind belongs to one or more parts,
// and the server checks that on every read and write, so hiding a menu item is never the only lock.
export const SECTIONS = [
  { key: 'library', label: 'Library', detail: 'Books, series, loans, wishlist, scanning' },
  { key: 'sermons', label: 'Sermons', detail: 'Sermon catalog, manuscripts, review' },
  { key: 'prayers', label: 'Prayers', detail: 'Prayer library, builder, saved services' },
  { key: 'notes', label: 'Devotions & Notes', detail: 'Devotions and sermon notes' },
  { key: 'children', label: 'Children’s Messages', detail: 'Pre-K and chapel messages' },
  {
    key: 'hymns',
    label: 'Hymns & Liturgies',
    detail: 'Hymn catalog, liturgies, attached sheet music',
  },
] as const
export type SectionKey = (typeof SECTIONS)[number]['key']
export const SECTION_KEYS: string[] = SECTIONS.map((s) => s.key)

const KINDS: Record<SectionKey, string[]> = {
  library: ['book', 'series', 'loan'],
  sermons: ['sermon'],
  prayers: ['prayer', 'prayerset'],
  notes: ['note'],
  children: ['note'],
  hymns: ['hymn', 'liturgy'],
}
export function cleanSections(input: unknown): SectionKey[] {
  if (!Array.isArray(input)) return []
  return SECTION_KEYS.filter((k) => input.includes(k)) as SectionKey[]
}
export function kindsFor(sections: readonly string[]): string[] {
  return [...new Set(sections.flatMap((s) => KINDS[s as SectionKey] ?? []))]
}
