// Builds the Lexham English Bible text that Bible Study reads from public/data/english/leb/<book number>.json.
//
//   node scripts/buildLebText.mjs <checkout of BibleCorps/ENG-B-LEB2012-cc-USFM>
//
// The LEB is free to use with credit (Logos Bible Software). Footnotes, headings and markup are removed;
// what is kept is the verse text, with poetry lines joined into their verse.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const [root] = process.argv.slice(2)
if (!root) throw new Error('Usage: node scripts/buildLebText.mjs <LEB USFM checkout>')
const out = join(import.meta.dirname, '..', 'public', 'data', 'english', 'leb')
mkdirSync(out, { recursive: true })

// Text lines that continue the current verse; every other marker (headings, titles, ids) is skipped.
const CONTINUES = /^\\(?:q\d?|m|pc|p|li\d?|b)\b\s*(.*)$/
const clean = (text) =>
  text
    .replace(/\\(ef?|f)\s[\s\S]*?\\\1\*/g, '') // footnotes
    .replace(/\\[a-z]+\d?\*?/g, '') // remaining inline markers (\add, \add*, \xt ...)
    .replace(/[⸤⸥]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

let verses = 0
for (const file of readdirSync(root).filter((f) => /^\d\d ENG/.test(f))) {
  const number = Number(file.slice(0, 2))
  if (number < 1 || number > 66) continue
  const book = {}
  let chapter = ''
  let verse = ''
  const raw = {}
  for (const line of readFileSync(join(root, file), 'utf8').split('\n')) {
    const c = /^\\c\s+(\d+)/.exec(line)
    if (c) {
      chapter = c[1]
      verse = ''
      continue
    }
    const v = /^\\v\s+(\d+)[-–]?\d*\s*(.*)$/.exec(line)
    if (v) {
      verse = v[1]
      raw[`${chapter}.${verse}`] = v[2]
      continue
    }
    const more = CONTINUES.exec(line)
    if (more && verse) raw[`${chapter}.${verse}`] += ' ' + more[1]
    else if (verse && line.trim() && !line.startsWith('\\'))
      raw[`${chapter}.${verse}`] += ' ' + line
  }
  for (const [key, text] of Object.entries(raw)) {
    const [c, v] = key.split('.')
    const words = clean(text)
    if (words) (((book[c] ??= {})[v] = words), verses++)
  }
  writeFileSync(join(out, `${number}.json`), JSON.stringify(book))
}
console.log(`leb: ${verses} verses`)
