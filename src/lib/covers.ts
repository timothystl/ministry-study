export interface CoverCandidate {
  id: string
  title: string
  author: string
  publication: string
  isbn: string
  editionSpecific: boolean
  imageUrl: string
  sourceUrl: string
}
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
const text = (value: unknown) => (typeof value === 'string' ? value : '')
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
export function normalizeIsbn(input: string) {
  const isbn = input.replace(/[\s-]/g, '').toUpperCase()
  if (/^\d{9}[\dX]$/.test(isbn)) {
    if (
      [...isbn].reduce((sum, n, i) => sum + (n === 'X' ? 10 : Number(n)) * (10 - i), 0) % 11 ===
      0
    )
      return isbn
  }
  if (/^97[89]\d{10}$/.test(isbn)) {
    if ([...isbn].reduce((sum, n, i) => sum + Number(n) * (i % 2 ? 3 : 1), 0) % 10 === 0)
      return isbn
  }
  return ''
}
export function coverSearchUrl(
  mode: 'isbn' | 'title',
  isbn: string,
  title: string,
  author: string,
) {
  if (mode === 'isbn') {
    const key = normalizeIsbn(isbn)
    if (!key) throw new Error('Enter a valid ISBN-10 or ISBN-13 from the book.')
    return `https://openlibrary.org/isbn/${key}.json`
  }
  if (!title.trim()) throw new Error('Enter a title to search.')
  return `https://openlibrary.org/search.json?${new URLSearchParams({ title: title.trim(), ...(author.trim() ? { author: author.trim() } : {}), fields: 'key,title,author_name,first_publish_year,cover_i,edition_count', limit: '12' })}`
}
export function parseCoverResults(value: unknown, isbn = ''): CoverCandidate[] {
  const data = object(value)
  if (isbn) {
    const cover = Array.isArray(data.covers)
      ? data.covers.find((v) => Number.isSafeInteger(v) && Number(v) > 0)
      : undefined
    if (!cover || !text(data.title)) return []
    return [
      {
        id: isbn,
        title: text(data.title),
        author: text(data.by_statement),
        publication: [
          ...strings(data.publishers),
          text(data.publish_date),
          text(data.physical_format),
        ]
          .filter(Boolean)
          .join(' · '),
        isbn,
        editionSpecific: true,
        imageUrl: `https://covers.openlibrary.org/b/id/${cover}-L.jpg?default=false`,
        sourceUrl: `https://openlibrary.org/isbn/${isbn}`,
      },
    ]
  }
  if (!Array.isArray(data.docs))
    throw new Error('Open Library returned an unexpected response. Please try again.')
  return data.docs.flatMap((value): CoverCandidate[] => {
    const item = object(value),
      key = text(item.key)
    if (
      !/^\/works\/OL\d+W$/.test(key) ||
      !text(item.title) ||
      !Number.isSafeInteger(item.cover_i) ||
      Number(item.cover_i) <= 0
    )
      return []
    return [
      {
        id: key,
        title: text(item.title),
        author: strings(item.author_name).join('; '),
        publication: Number.isInteger(item.first_publish_year)
          ? `First published ${item.first_publish_year}`
          : '',
        isbn: '',
        editionSpecific: false,
        imageUrl: `https://covers.openlibrary.org/b/id/${item.cover_i}-L.jpg?default=false`,
        sourceUrl: `https://openlibrary.org${key}`,
      },
    ]
  })
}
