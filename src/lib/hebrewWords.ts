// Word-by-word Hebrew for the Bible Study page: every word of the Old Testament with its English, Strong's
// tags and grammar (STEPBible's TAHOT), and the lexicon and grammar tables that explain them.
// [Hebrew, transliteration, English, Strong's tags, grammar, text type when not plain Leningrad]
export type HebrewWord = [string, string, string, string, string, string?]

// A Hebrew word is often several pieces written together ("and/ the/ earth"): a prefix, the word itself, a
// suffix. The fields carry the pieces separated by / (and \ before punctuation).
export interface WordPart {
  hebrew: string
  translit: string
  gloss: string
  // Disambiguated Strong's tag, e.g. H7225G, and the plain number, H7225.
  tag: string
  number: string
  grammar: string
  role: 'root' | 'prefix' | 'suffix'
}
const split = (text: string, pattern: RegExp) => text.split(pattern).map((p) => p.trim())

// The word as it is read: pieces joined, punctuation marks kept.
export const plainHebrew = (word: HebrewWord) => word[0].replace(/[/\\]/g, '')

export function wordParts(word: HebrewWord): WordPart[] {
  const [hebrew, translit, gloss, tags, grammar] = word
  const forms = split(hebrew, /[/\\]/),
    sounds = split(translit, /[/\\]/),
    meanings = split(gloss, /\//),
    strongs = split(tags, /[/\\]/),
    codes = split(grammar, /[/\\]/)
  const rootAt = strongs.findIndex((s) => s.includes('{'))
  return strongs.flatMap((raw, i) => {
    const tag = raw.replace(/[{}+\s]/g, '')
    // Punctuation marks (such as H9016, the verse end) are not words to study.
    if (!/^H\d{4}/.test(tag) || tag === 'H9016') return []
    const root = rootAt < 0 ? i === 0 : i === rootAt
    return [
      {
        hebrew: forms[i] ?? '',
        translit: sounds[i] ?? '',
        gloss: meanings[i] ?? '',
        tag,
        number: tag.slice(0, 5),
        grammar: codes[i] ?? '',
        role: root ? 'root' : rootAt >= 0 && i > rootAt ? 'suffix' : 'prefix',
      } as WordPart,
    ]
  })
}

export type LexiconEntry = [hebrew: string, translit: string, gloss: string, grammar: string]
export interface HebrewTables {
  lexicon: Record<string, LexiconEntry>
  morph: Record<string, string>
}
let tables: Promise<HebrewTables> | null = null
export function loadHebrewTables(): Promise<HebrewTables> {
  tables ??= (async () => {
    const [lexicon, morph] = await Promise.all(
      ['lexicon', 'morph'].map(async (name) => {
        const response = await fetch(`/data/hebrew/${name}.json`)
        if (!(response.headers.get('Content-Type') || '').includes('json'))
          throw new Error('The word-study tables are not available here.')
        return response.json()
      }),
    )
    return { lexicon, morph } as HebrewTables
  })()
  tables.catch(() => (tables = null))
  return tables
}
export function lookupLexicon(t: HebrewTables, tag: string): LexiconEntry | undefined {
  return (
    t.lexicon[tag] ??
    t.lexicon[tag.slice(0, 5)] ??
    t.lexicon[Object.keys(t.lexicon).find((k) => k.startsWith(tag.slice(0, 5))) ?? '']
  )
}
// "HVqp3ms" and, after a prefix, the bare "Sp3ms": the language letter comes from the first piece.
export function explainGrammar(t: HebrewTables, code: string, language: string): string {
  const text = t.morph[code] ?? t.morph[`${language}${code}`] ?? ''
  return text.replace(/\s*;\s*/g, ' · ')
}
