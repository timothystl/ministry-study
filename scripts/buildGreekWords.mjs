// Builds the Greek word-study data that Bible Study reads from public/data/greek-words/.
//
//   node scripts/buildGreekWords.mjs <STEPBible-Data checkout>
//
// From STEPBible's Translators Amalgamated Greek NT (TAGNT, CC BY 4.0): the words marked as Nestle-Aland 28,
// each with its transliteration, English, Strong's number, grammar, and dictionary form with gloss. Written as
// <book number>.json (chapter → verse → words) plus morph.json (grammar codes explained, from TEGMC).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const [root] = process.argv.slice(2)
if (!root) throw new Error('Usage: node scripts/buildGreekWords.mjs <STEPBible-Data>')
const out = join(import.meta.dirname, '..', 'public', 'data', 'greek-words')
mkdirSync(out, { recursive: true })

const order =
  `Mat Mrk Luk Jhn Act Rom 1Co 2Co Gal Eph Php Col 1Th 2Th 1Ti 2Ti Tit Phm Heb Jas 1Pe 2Pe 1Jn 2Jn 3Jn Jud Rev`.split(
    /\s+/,
  )
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/^﻿/, '').split('\n')

const books = {}
let words = 0
for (const name of [
  'TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt',
  'TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt',
]) {
  for (const line of read(join('Translators Amalgamated OT+NT', name))) {
    const cols = line.split('\t')
    const m = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)[^#\t]*#\d+=/.exec(cols[0])
    const book = m ? order.indexOf(m[1]) + 40 : 0
    if (!m || book < 40 || cols.length < 6 || !cols[5].split('+').includes('NA28')) continue
    const form = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(cols[1].trim())
    const greek = form ? form[1] : cols[1].trim()
    if (!greek) continue
    const [strongs, grammar] = (cols[3] || '').split('=')
    const verse = (((books[book] ??= {})[m[2]] ??= {})[m[3]] ??= [])
    verse.push([
      greek,
      form ? form[2] : '',
      cols[2].trim(),
      (strongs || '').trim(),
      (grammar || '').trim(),
      (cols[4] || '').trim(),
    ])
    words++
  }
}
for (const [book, chapters] of Object.entries(books))
  writeFileSync(join(out, `${book}.json`), JSON.stringify(chapters))

const morph = {}
for (const line of read(
  'Morphology codes/TEGMC - Translators Expansion of Greek Morphhology Codes - STEPBible.org CC BY.txt',
)) {
  const c = line.split('\t')
  if (c.length >= 2 && /^[A-Z][A-Z0-9-]*$/.test(c[0]) && c[1].includes('Function='))
    morph[c[0]] = c[1].trim()
}
writeFileSync(join(out, 'morph.json'), JSON.stringify(morph))
console.log(
  `${words} words in ${Object.keys(books).length} books; ${Object.keys(morph).length} grammar codes`,
)
