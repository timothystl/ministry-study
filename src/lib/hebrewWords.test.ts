import { describe, expect, it } from 'vitest'
import {
  explainGrammar,
  lookupLexicon,
  plainHebrew,
  wordParts,
  type HebrewWord,
} from './hebrewWords'

const bereshit: HebrewWord = [
  'בְּ/רֵאשִׁ֖ית',
  'be./re.Shit',
  'in/ beginning',
  'H9003/{H7225G}',
  'HR/Ncfsa',
]
const ohalo: HebrewWord = [
  'אָהֳלֽ/וֹ\\׃',
  "'o.ho.L/o",
  'tent/ his',
  '{H0168G}/H9023\\H9016',
  'HNcmsc/Sp3ms',
]

describe('Hebrew words', () => {
  it('reads a word as it is written, without the piece markers', () => {
    expect(plainHebrew(bereshit)).toBe('בְּרֵאשִׁ֖ית')
    expect(plainHebrew(ohalo)).toBe('אָהֳלֽוֹ׃')
  })
  it('splits a word into its prefix, root and ending', () => {
    expect(wordParts(bereshit).map((p) => [p.role, p.tag, p.number, p.gloss])).toEqual([
      ['prefix', 'H9003', 'H9003', 'in'],
      ['root', 'H7225G', 'H7225', 'beginning'],
    ])
    const parts = wordParts(ohalo)
    expect(parts.map((p) => [p.role, p.tag, p.grammar])).toEqual([
      ['root', 'H0168G', 'HNcmsc'],
      ['suffix', 'H9023', 'Sp3ms'],
    ])
  })
  it('finds lexicon entries and explains grammar codes, using the word’s language for later pieces', () => {
    const tables = {
      lexicon: {
        H7225G: ['רֵאשִׁית', 're.shit', 'beginning', 'H:N-F'] as [string, string, string, string],
      },
      morph: {
        HNcfsa: 'Function=Noun ; Gender=Feminine',
        HSp3ms: 'Function=Suffix ; Person=Third',
      },
    }
    expect(lookupLexicon(tables, 'H7225G')?.[2]).toBe('beginning')
    expect(lookupLexicon(tables, 'H7225A')?.[2]).toBe('beginning')
    expect(lookupLexicon(tables, 'H0001')).toBeUndefined()
    expect(explainGrammar(tables, 'HNcfsa', 'H')).toBe('Function=Noun · Gender=Feminine')
    expect(explainGrammar(tables, 'Sp3ms', 'H')).toBe('Function=Suffix · Person=Third')
  })
})
