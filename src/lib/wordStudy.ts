// Word-by-word study for the Bible Study page: every word of the Old Testament in Hebrew (STEPBible's TAHOT)
// and of the New Testament in Greek (STEPBible's TAGNT, the NA28 words), with its English, Strong's tag and
// grammar, and the tables that explain them.
// Hebrew: [Hebrew, transliteration, English, Strong's tags, grammar, text type when not plain Leningrad]
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
  // Greek words carry their dictionary form and gloss with them; Hebrew ones are looked up in the lexicon.
  lemma?: string
  lemmaGloss?: string
}
// Greek: [Greek, transliteration, English, Strong's number, grammar, "dictionary form=gloss"]
export type GreekWord = [string, string, string, string, string, string]

// What the panel shows, whichever language the word is in.
export interface StudyWord {
  text: string
  translit: string
  gloss: string
  language: 'Hebrew' | 'Greek'
  note?: string
  parts: WordPart[]
}
export function hebrewStudyWord(word: HebrewWord): StudyWord {
  return {
    text: plainHebrew(word),
    translit: word[1].replace(/[/\\]/g, ''),
    gloss: word[2].replace(/\s*\/\s*/g, ' '),
    language: 'Hebrew',
    note:
      word[5] === 'Q'
        ? 'Qere: the scribes’ corrected reading, followed by translators.'
        : word[5]
          ? 'This word is added or restored in STEPBible’s text.'
          : undefined,
    parts: wordParts(word),
  }
}
export function greekStudyWord(word: GreekWord): StudyWord {
  const [greek, translit, gloss, tag, grammar, dictionary] = word
  const [lemma, lemmaGloss] = dictionary.split('=')
  return {
    text: greek,
    translit,
    gloss: gloss.replace(/[<>]/g, ''),
    language: 'Greek',
    parts: [
      {
        hebrew: greek,
        translit,
        gloss: gloss.replace(/[<>]/g, ''),
        tag,
        number: tag,
        // Words that stand for two joined words are tagged "CONJ + G5104": the first code describes the word.
        grammar: grammar.split(/\s*\+\s*/)[0],
        role: 'root',
        lemma,
        lemmaGloss,
      },
    ],
  }
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
export interface StudyTables {
  lexicon: Record<string, LexiconEntry>
  morph: Record<string, string>
}
const tables: Partial<Record<StudyWord['language'], Promise<StudyTables>>> = {}
export function loadStudyTables(language: StudyWord['language']): Promise<StudyTables> {
  const fetchJson = async (path: string) => {
    const response = await fetch(path)
    if (!(response.headers.get('Content-Type') || '').includes('json'))
      throw new Error('The word-study tables are not available here.')
    return response.json()
  }
  const found = (tables[language] ??=
    language === 'Hebrew'
      ? Promise.all([
          fetchJson('/data/hebrew/lexicon.json'),
          fetchJson('/data/hebrew/morph.json'),
        ]).then(([lexicon, morph]) => ({ lexicon, morph }))
      : fetchJson('/data/greek-words/morph.json').then((morph) => ({ lexicon: {}, morph })))
  found.catch(() => delete tables[language])
  return found
}
export function lookupLexicon(t: StudyTables, tag: string): LexiconEntry | undefined {
  return (
    t.lexicon[tag] ??
    t.lexicon[tag.slice(0, 5)] ??
    t.lexicon[Object.keys(t.lexicon).find((k) => k.startsWith(tag.slice(0, 5))) ?? '']
  )
}
// Hebrew "HVqp3ms" and, after a prefix, the bare "Sp3ms": the language letter comes from the first piece.
// Greek codes such as "V-AAI-3S" stand alone.
export function explainGrammar(t: StudyTables, code: string, language: string): string {
  const text = t.morph[code] ?? t.morph[`${language}${code}`] ?? ''
  return text.replace(/\s*;\s*/g, ' · ')
}
