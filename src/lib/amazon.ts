import type { WishlistRow } from './wishlist'

export interface AmazonItem extends WishlistRow {
  selected: boolean
  warning: string
}
export interface AmazonList {
  name: string
  items: AmazonItem[]
}
const clean = (text: string | null | undefined) => (text || '').replace(/\s+/g, ' ').trim()
const printFormat =
  /^(Paperback|Hardcover|Mass Market Paperback|Spiral-bound|Board book|Library Binding|Leather Bound|Imitation Leather|Unbound|Perfect Paperback|Flexibound|Loose Leaf|Textbook Binding|Unknown Binding)$/i
export function amazonListUrl(input: string): string {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new Error('Enter the full Amazon.com wishlist share link.')
  }
  const match = url.pathname.match(/^\/hz\/wishlist\/ls\/([A-Z0-9]+)\/?$/i)
  if (
    url.protocol !== 'https:' ||
    !['amazon.com', 'www.amazon.com'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    !match
  )
    throw new Error('Use an HTTPS Amazon.com wishlist share link.')
  return `https://www.amazon.com/hz/wishlist/ls/${match[1]}`
}
function isbn10(asin: string) {
  if (!/^\d{9}[\dX]$/.test(asin)) return ''
  const total = [...asin].reduce(
    (sum, char, i) => sum + (char === 'X' ? 10 : Number(char)) * (10 - i),
    0,
  )
  return total % 11 === 0 ? asin : ''
}
function item(
  title: string,
  byline: string,
  edition: string,
  asin = '',
  coverUrl = '',
  listName = '',
): AmazonItem {
  const author = byline
    .replace(/^by\s+/i, '')
    .replace(/\s*\([^()]*\)\s*$/, '')
    .trim()
  const isPrint = printFormat.test(edition),
    isKindle = /^Kindle(?: Edition)?$/i.test(edition)
  const warning = !edition
    ? 'Format not identified; check that this is a book.'
    : !isPrint && !isKindle
      ? `Unsupported format: ${edition}.`
      : !author
        ? 'Author not supplied by Amazon.'
        : ''
  return {
    title,
    author,
    isbn: isPrint ? isbn10(asin) : '',
    format: isKindle ? 'Kindle' : 'Physical',
    source: 'Amazon wishlist',
    sourceId: asin,
    sourceMetadata: {
      'Amazon list': listName,
      'Amazon ASIN': asin,
      'Amazon edition': edition,
      'Amazon byline': byline,
      ...(asin ? { 'Amazon product URL': `https://www.amazon.com/dp/${asin}` } : {}),
    },
    coverUrl,
    selected: Boolean(isPrint || isKindle),
    warning,
  }
}

// Parse in an inert template, never mount the imported HTML or execute its scripts.
export function parseAmazonHtml(html: string): AmazonList {
  const template = document.createElement('template')
  template.innerHTML = html
  const root = template.content
  const name = clean(root.querySelector('#profile-list-name')?.textContent) || 'Amazon wishlist'
  const links = [...root.querySelectorAll('a[id^="itemName_"]')]
  if (!links.length)
    throw new Error(
      'No Amazon wishlist items found. Save the loaded wishlist page as HTML, not a sign-in page or PDF.',
    )
  if (links.length > 2000) throw new Error('Import at most 2,000 items at a time.')
  const items: AmazonItem[] = []
  const seen = new Set<string>()
  for (const link of links) {
    const id = link.id.slice('itemName_'.length)
    if (seen.has(id)) continue
    seen.add(id)
    const title = clean(link.getAttribute('title') || link.textContent)
    if (!title) continue
    const info = root.getElementById(`itemInfo_${id}`)
    const byline = clean(root.getElementById(`item-byline-${id}`)?.textContent)
    const edition =
      clean(info?.querySelector('[id="twisterText"]')?.textContent).replace(
        /^Format\s*:\s*/i,
        '',
      ) ||
      byline.match(/\(([^()]*)\)\s*$/)?.[1] ||
      ''
    let asin = ''
    try {
      const product = new URL(link.getAttribute('href') || '', 'https://www.amazon.com')
      if (
        product.protocol === 'https:' &&
        ['www.amazon.com', 'amazon.com'].includes(product.hostname)
      )
        asin = product.pathname.match(/\/dp\/([A-Z0-9]{10})(?:\/|$)/i)?.[1].toUpperCase() || ''
    } catch {
      /* Unknown product links are not retained. */
    }
    let cover = ''
    try {
      const image = new URL(link.closest('li')?.querySelector('img')?.getAttribute('src') || '')
      if (image.protocol === 'https:' && image.hostname === 'm.media-amazon.com') cover = image.href
    } catch {
      /* Locally saved image paths do not transfer between computers. */
    }
    items.push(item(title, byline, edition, asin, cover, name))
  }
  if (!items.length) throw new Error('No titled wishlist items were found.')
  return { name, items }
}

export function parseAmazonText(text: string): AmazonList {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean)
  const items: AmazonItem[] = []
  for (let i = 1; i < lines.length; i++) {
    const byline = lines[i].match(/^by\s+(.+)\s+\(([^()]*)\)$/i)
    if (!byline) continue
    const title = lines[i - 1]
    if (
      /^(?:Format\s*:|Add to Cart|Buying this gift|See all buying|\d+(?:\.\d+)? out of)/i.test(
        title,
      )
    )
      continue
    items.push(item(title, lines[i], byline[2]))
  }
  if (!items.length)
    throw new Error(
      'No book titles and author lines found. Copy the loaded Amazon list in list view, or choose its saved HTML page.',
    )
  if (items.length > 2000) throw new Error('Import at most 2,000 items at a time.')
  return { name: 'Copied Amazon list', items }
}
