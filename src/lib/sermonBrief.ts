import { findReference, formatReferences, parseReferences } from './scripture'

// What a prayer needs from a sermon: where it is preached from, what it is about, where the gospel
// lands, and how it ends. Read in the browser from the pastor's own file; nothing is sent anywhere.
export interface SermonBrief {
  title: string
  scripture: string
  themes: string[] // keys of the sermon-theme starters, best match first
  gospel: string
  opening: string
  closing: string
}

// Words that point to a sermon theme. The keys are the sermon-theme starters' names.
const THEME_WORDS: Record<string, RegExp> = {
  resurrection: /\b(resurrect\w*|risen|rose again|empty tomb|easter|raised)\b/gi,
  cross: /\b(cross|crucif\w*|calvary|suffer\w*)\b/gi,
  forgiveness: /\b(forgiv\w*|absolution|pardon\w*|reconcil\w*|repent\w*)\b/gi,
  fear: /\b(fear\w*|afraid|anxi\w*|worr\w*|terrif\w*)\b/gi,
  healing: /\b(heal\w*|sick\w*|illness|cancer|diagnos\w*|whole\w*)\b/gi,
  kingdom: /\b(kingdom|reign\w*|king of|rule of god)\b/gi,
  grace: /\b(grace|gift|undeserved|mercy|merciful)\b/gi,
  holy_spirit: /\b(spirit|pentecost|advocate|breath of god)\b/gi,
  word: /\b(the word|scripture|promise|proclaim\w*|preach\w*)\b/gi,
  calling: /\b(calling|called|vocation|sent|follow me|disciple\w*)\b/gi,
  stewardship: /\b(steward\w*|offering|tithe\w*|treasure|money|giving|entrusted)\b/gi,
  generosity: /\b(generous\w*|generosity|give freely|cheerful giver|open hand\w*)\b/gi,
  time_and_talents:
    /\b(talents?|gifts? of the spirit|volunteer\w*|serve one another|your hands)\b/gi,
  contentment: /\b(content\w*|enough|greed\w*|possessions|debt|barn)\b/gi,
  creation_care: /\b(creation|earth|soil|garden|animals|environment)\b/gi,
}
const GOSPEL =
  /\b(for you|jesus|christ|cross|forgiv\w*|grace|raised|his blood|baptized|given and shed)\b/gi
const count = (text: string, re: RegExp) => (text.match(re) || []).length

const paragraphs = (text: string) =>
  text
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
const sentences = (p: string) =>
  p.match(/[^.!?]+[.!?]+["”’)]*|[^.!?]+$/g)?.map((s) => s.trim()) ?? []
const short = (s: string, max = 400) =>
  s.length > max ? `${s.slice(0, max).replace(/\s+\S*$/, '')}…` : s

export function themeLabel(key: string) {
  const text = key.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function briefFromSermon(text: string, fileName = ''): SermonBrief {
  const paras = paragraphs(text)
  if (!paras.join(' ').trim()) throw new Error('The file is empty.')
  const fromFile = fileName
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/^\d{3,5}[_\s-]+/, '')
    .replace(/[_]+/g, ' ')
    .trim()
  const firstLine = paras[0]
  const title = firstLine.length <= 90 && !/[.!?]$/.test(firstLine) ? firstLine : fromFile
  const head = paras.slice(0, 12).join('\n')
  const found = findReference(head) || findReference(text)
  const scripture = found ? formatReferences(parseReferences(found).refs) || found : ''
  const body = paras.filter((p) => p !== title && p.length >= 60)
  const themes = Object.entries(THEME_WORDS)
    .map(([key, re]) => [key, count(text, re)] as const)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key)
  // The gospel line: the sentence in the last third that speaks most of Christ and "for you".
  const tail = body.slice(Math.floor((body.length * 2) / 3)).flatMap(sentences)
  const gospel =
    tail
      .filter((s) => s.length >= 40 && s.length <= 300)
      .map((s) => [s, count(s, GOSPEL)] as const)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  return {
    title,
    scripture,
    themes,
    gospel: short(gospel, 300),
    opening: short(body[0] ?? ''),
    closing: short(body.at(-1) ?? ''),
  }
}

// A note to paste into the Prayer Writer (or any assistant): everything it needs, nothing more.
export function briefForWriter(b: SermonBrief): string {
  const facts = [
    `Sermon: ${b.title || '(untitled)'}`,
    b.scripture && `Text: ${b.scripture}`,
    b.themes.length > 0 && `Themes: ${b.themes.map(themeLabel).join(', ')}`,
    b.gospel && `Where the gospel lands: ${b.gospel}`,
    b.opening && `How it opens: ${b.opening}`,
    b.closing && `How it closes: ${b.closing}`,
  ].filter((x): x is string => typeof x === 'string' && x !== '')
  return [
    'Please write the sermon-tied petition for the Prayers of the Church, in my voice: direct address to God, honest about pain, rooted in the gospel, about 80 to 120 words, ending "Lord, in your mercy,".',
    '',
    ...facts,
  ].join('\n')
}
