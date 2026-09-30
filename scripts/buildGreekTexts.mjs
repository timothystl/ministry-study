// Builds the Greek New Testament texts that Bible Study reads from public/data/greek/<edition>/<book number>.json.
//
//   node scripts/buildGreekTexts.mjs <SBLGNT checkout> <STEPBible-Data checkout>
//
// - sblgnt: the SBL Greek New Testament (github.com/LogosBible/SBLGNT, CC BY 4.0), apparatus marks removed.
// - na28, thgnt: rebuilt from STEPBible's TAGNT (github.com/STEPBible/STEPBible-Data, CC BY 4.0), which marks
//   every word with the editions that contain it. The NA28 and Tyndale House readings are the words marked
//   NA28 and Tyn, in file order, so they follow STEPBible's reading of those editions (no apparatus).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const [sblRoot, stepRoot] = process.argv.slice(2)
if (!sblRoot || !stepRoot)
  throw new Error('Usage: node scripts/buildGreekTexts.mjs <SBLGNT> <STEPBible-Data>')
const out = join(import.meta.dirname, '..', 'public', 'data', 'greek')

// Book number (canonical 1–66), SBLGNT file name, TAGNT code.
const books = [
  [40, 'Matt', 'Mat'],
  [41, 'Mark', 'Mrk'],
  [42, 'Luke', 'Luk'],
  [43, 'John', 'Jhn'],
  [44, 'Acts', 'Act'],
  [45, 'Rom', 'Rom'],
  [46, '1Cor', '1Co'],
  [47, '2Cor', '2Co'],
  [48, 'Gal', 'Gal'],
  [49, 'Eph', 'Eph'],
  [50, 'Phil', 'Php'],
  [51, 'Col', 'Col'],
  [52, '1Thess', '1Th'],
  [53, '2Thess', '2Th'],
  [54, '1Tim', '1Ti'],
  [55, '2Tim', '2Ti'],
  [56, 'Titus', 'Tit'],
  [57, 'Phlm', 'Phm'],
  [58, 'Heb', 'Heb'],
  [59, 'Jas', 'Jas'],
  [60, '1Pet', '1Pe'],
  [61, '2Pet', '2Pe'],
  [62, '1John', '1Jn'],
  [63, '2John', '2Jn'],
  [64, '3John', '3Jn'],
  [65, 'Jude', 'Jud'],
  [66, 'Rev', 'Rev'],
]
const byTagnt = new Map(books.map(([n, , code]) => [code, n]))
const editions = { sblgnt: {}, na28: {}, thgnt: {} }
const put = (edition, book, chapter, verse, text) => {
  const b = (editions[edition][book] ??= {})
  ;(b[chapter] ??= {})[verse] = text
}
const tidy = (text) => text.replace(/[⸀-⹿]/g, '').replace(/\s+/g, ' ').trim()

for (const [number, file] of books.map((b) => [b[0], b[1]])) {
  const lines = readFileSync(join(sblRoot, 'data', 'sblgnt', 'text', `${file}.txt`), 'utf8').split(
    '\n',
  )
  for (const line of lines) {
    const m = /^[^\t]*?(\d+):(\d+)\t(.*)$/.exec(line)
    if (m) put('sblgnt', number, m[1], m[2], tidy(m[3]))
  }
}
const dir = join(stepRoot, 'Translators Amalgamated OT+NT')
for (const name of [
  'TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt',
  'TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt',
]) {
  const words = new Map() // "book.chapter.verse" -> { na28: [], thgnt: [] }
  for (const line of readFileSync(join(dir, name), 'utf8').split('\n')) {
    const cols = line.split('\t')
    const ref = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)[^#]*#\d+=/.exec(cols[0])
    if (!ref || !byTagnt.has(ref[1]) || cols.length < 6) continue
    const editionList = cols[5].split('+')
    const greek = cols[1].replace(/\s*\([^)]*\)\s*$/, '').trim()
    if (!greek) continue
    const key = `${byTagnt.get(ref[1])}.${ref[2]}.${ref[3]}`
    const entry = words.get(key) ?? { na28: [], thgnt: [] }
    if (editionList.includes('NA28')) entry.na28.push(greek)
    if (editionList.includes('Tyn')) entry.thgnt.push(greek)
    words.set(key, entry)
  }
  for (const [key, entry] of words) {
    const [book, chapter, verse] = key.split('.')
    if (entry.na28.length) put('na28', Number(book), chapter, verse, entry.na28.join(' '))
    if (entry.thgnt.length) put('thgnt', Number(book), chapter, verse, entry.thgnt.join(' '))
  }
}
for (const [edition, data] of Object.entries(editions)) {
  mkdirSync(join(out, edition), { recursive: true })
  for (const [book, chapters] of Object.entries(data))
    writeFileSync(join(out, edition, `${book}.json`), JSON.stringify(chapters))
  const verses = Object.values(data).reduce(
    (n, chapters) => n + Object.values(chapters).reduce((m, v) => m + Object.keys(v).length, 0),
    0,
  )
  console.log(`${edition}: ${Object.keys(data).length} books, ${verses} verses`)
}
