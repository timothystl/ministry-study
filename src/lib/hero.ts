export type HeroQuote = { text: string; by: string }

export const HERO_IMAGES = [
  '/assets/mountain-banner.png',
  '/assets/banners/alpine-ridge.jpg',
  '/assets/banners/forest-sea.jpg',
  '/assets/banners/misty-valley.jpg',
  '/assets/banners/pine-forest.jpg',
  '/assets/banners/pond-dock.jpg',
  '/assets/banners/ridge-hiker.jpg',
  '/assets/banners/sea-cliffs.jpg',
  '/assets/banners/sea-dawn.jpg',
  '/assets/banners/sunlit-barn.jpg',
  '/assets/banners/sunset-meadow.jpg',
  '/assets/banners/waterfall.jpg',
  '/assets/banners/wheat-field.jpg',
]

export const HERO_QUOTES: HeroQuote[] = [
  {
    text: 'The more that you read, the more things you will know. The more that you learn, the more places you’ll go.',
    by: 'Dr. Seuss',
  },
  { text: 'Take up and read.', by: 'Augustine, Confessions' },
  {
    text: 'Reading maketh a full man; conference a ready man; and writing an exact man.',
    by: 'Francis Bacon',
  },
  {
    text: 'Some books are to be tasted, others to be swallowed, and some few to be chewed and digested.',
    by: 'Francis Bacon',
  },
  { text: 'A book must be the axe for the frozen sea within us.', by: 'Franz Kafka' },
  {
    text: 'I have always imagined that Paradise will be a kind of library.',
    by: 'Jorge Luis Borges',
  },
  {
    text: 'The reading of all good books is like a conversation with the finest minds of past centuries.',
    by: 'René Descartes',
  },
  {
    text: 'Books are the quietest and most constant of friends; they are the most accessible and wisest of counselors, and the most patient of teachers.',
    by: 'Charles W. Eliot',
  },
  {
    text: 'Until I feared I would lose it, I never loved to read. One does not love breathing.',
    by: 'Harper Lee, To Kill a Mockingbird',
  },
  { text: 'We read to know we are not alone.', by: 'William Nicholson, Shadowlands' },
  { text: 'Visit many good books, but live in the Bible.', by: 'Charles Spurgeon' },
  { text: 'The Bible is the cradle wherein Christ is laid.', by: 'Martin Luther' },
  { text: 'Your word is a lamp to my feet and a light to my path.', by: 'Psalm 119:105' },
  {
    text: 'A word fitly spoken is like apples of gold in a setting of silver.',
    by: 'Proverbs 25:11',
  },
  {
    text: 'How we spend our days is, of course, how we spend our lives.',
    by: 'Annie Dillard, The Writing Life',
  },
  {
    text: 'We shall not cease from exploration, and the end of all our exploring will be to arrive where we started and know the place for the first time.',
    by: 'T. S. Eliot, Little Gidding',
  },
  {
    text: 'A reader lives a thousand lives before he dies. The man who never reads lives only one.',
    by: 'George R. R. Martin',
  },
]

// Picks a random index, never repeating `last` when there is a choice.
export function pickIndex(count: number, last: number | null, random = Math.random): number {
  if (count <= 1) return 0
  let i = Math.floor(random() * count)
  if (i === last) i = (i + 1 + Math.floor(random() * (count - 1))) % count
  return i
}

const KEY = 'ministry-study-hero'

function remembered(): { image: number; quote: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null')
    return typeof v?.image === 'number' && typeof v?.quote === 'number' ? v : null
  } catch {
    return null
  }
}

// A new picture and quote on each load, different from the previous visit.
export function nextHero(random = Math.random): { image: string; quote: HeroQuote } {
  const last = remembered()
  const image = pickIndex(HERO_IMAGES.length, last?.image ?? null, random)
  const quote = pickIndex(HERO_QUOTES.length, last?.quote ?? null, random)
  try {
    localStorage.setItem(KEY, JSON.stringify({ image, quote }))
  } catch {
    // Private mode or blocked storage: rotation still works, just without the memory.
  }
  return { image: HERO_IMAGES[image], quote: HERO_QUOTES[quote] }
}
