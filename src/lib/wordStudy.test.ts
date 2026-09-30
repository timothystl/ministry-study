import { describe, expect, it } from 'vitest'
import {
  explainGrammar,
  greekStudyWord,
  hebrewStudyWord,
  lookupLexicon,
  plainHebrew,
  wordParts,
  type HebrewWord,
} from './wordStudy'

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

describe('word study panel', () => {
  it('shapes a Hebrew word with its note', () => {
    const word = hebrewStudyWord([
      bereshit[0],
      bereshit[1],
      bereshit[2],
      bereshit[3],
      bereshit[4],
      'Q',
    ])
    expect(word).toMatchObject({ text: 'בְּרֵאשִׁ֖ית', language: 'Hebrew', gloss: 'in beginning' })
    expect(word.note).toMatch(/Qere/)
    expect(word.parts).toHaveLength(2)
  })
  it('shapes a Greek word, and uses the first code of a joined word', () => {
    const word = greekStudyWord([
      'ἠγάπησεν',
      'ēgapēsen',
      'loved',
      'G0025',
      'V-AAI-3S',
      'ἀγαπάω=to love',
    ])
    expect(word.parts[0]).toMatchObject({
      number: 'G0025',
      grammar: 'V-AAI-3S',
      lemma: 'ἀγαπάω',
      lemmaGloss: 'to love',
    })
    const joined = greekStudyWord(['x', 'x', '<the>', 'G1', 'CONJ + G5104', 'a=b'])
    expect(joined.parts[0].grammar).toBe('CONJ')
    expect(joined.gloss).toBe('the')
  })
})
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
