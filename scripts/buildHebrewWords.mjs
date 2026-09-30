// Builds the Hebrew word-study data that Bible Study reads from public/data/hebrew/.
//
//   node scripts/buildHebrewWords.mjs <STEPBible-Data checkout>
//
// From STEPBible's Translators Amalgamated Hebrew OT (TAHOT, CC BY 4.0): every word of the Old Testament with
// its transliteration, English, Strong's tags and grammar. Written as <book number>.json (chapter → verse →
// words), plus lexicon.json (one entry per Strong's tag, from STEPBible's TBESH) and morph.json (the
// grammar codes explained, from TEHMC).
//
// The TBESH "Meaning" column is abridged BDB from the Online Bible and needs their permission, so it is left
// out: only the Tyndale House glosses, Hebrew forms and transliterations are kept.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const [root] = process.argv.slice(2)
if (!root) throw new Error('Usage: node scripts/buildHebrewWords.mjs <STEPBible-Data>')
const out = join(import.meta.dirname, '..', 'public', 'data', 'hebrew')
mkdirSync(out, { recursive: true })

const order =
  `Gen Exo Lev Num Deu Jos Jdg Rut 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Neh Est Job Psa Pro Ecc Sng Isa Jer Lam Ezk Dan
  Hos Jol Amo Oba Jon Mic Nam Hab Zep Hag Zec Mal`.split(/\s+/)
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/^﻿/, '').split('\n')

const books = {}
const used = new Set()
let words = 0
for (const name of [
  'TAHOT Gen-Deu - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt',
  'TAHOT Jos-Est - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt',
  'TAHOT Job-Sng - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt',
  'TAHOT Isa-Mal - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt',
]) {
  for (const line of read(join('Translators Amalgamated OT+NT', name))) {
    const cols = line.split('\t')
    // "Gen.1.1#01=L": English reference, word number, and the text type (L Leningrad, Q qere, R, X ...).
    const m = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)[^#\t]*#\d+=([A-Z])/.exec(cols[0])
    const book = m ? order.indexOf(m[1]) + 1 : 0
    if (!m || !book || cols.length < 6 || Number(m[3]) < 1) continue
    const [hebrew, translit, gloss, strongs, grammar] = cols.slice(1, 6).map((c) => c.trim())
    if (!hebrew) continue
    const verse = (((books[book] ??= {})[m[2]] ??= {})[m[3]] ??= [])
    verse.push(
      m[4] === 'L'
        ? [hebrew, translit, gloss, strongs, grammar]
        : [hebrew, translit, gloss, strongs, grammar, m[4]],
    )
    words++
    for (const part of strongs.split(/[/\\]/)) used.add(part.replace(/[{}+\s]/g, ''))
  }
}
for (const [book, chapters] of Object.entries(books))
  writeFileSync(join(out, `${book}.json`), JSON.stringify(chapters))

// Lexicon: keyed by the disambiguated Strong's tag.
const lexicon = {}
for (const line of read(
  'Lexicons/TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY.txt',
)) {
  const c = line.split('\t')
  if (c.length < 7 || !/^H\d{4}/.test(c[0])) continue
  const key = c[1].split(' ')[0].trim()
  if (used.has(key)) lexicon[key] = [c[3], c[4], c[6], c[5]] // Hebrew, transliteration, gloss, brief grammar
}
writeFileSync(join(out, 'lexicon.json'), JSON.stringify(lexicon))

const morph = {}
for (const line of read(
  'Morphology codes/TEHMC - Translators Expansion of Hebrew Morphology Codes - STEPBible.org CC BY.txt',
)) {
  const c = line.split('\t')
  if (c.length >= 2 && /^[HA][A-Za-z0-9]/.test(c[0]) && c[1].includes('Function='))
    morph[c[0]] = c[1].trim()
}
writeFileSync(join(out, 'morph.json'), JSON.stringify(morph))
console.log(
  `${words} words in ${Object.keys(books).length} books; ${Object.keys(lexicon).length} lexicon entries; ${Object.keys(morph).length} grammar codes`,
)
