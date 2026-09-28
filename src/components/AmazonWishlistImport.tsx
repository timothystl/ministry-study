import { useMemo, useState } from 'react'
import { Upload } from 'lucide-react'
import type { Library } from '../lib/model'
import { amazonListUrl, parseAmazonHtml, parseAmazonText, type AmazonList } from '../lib/amazon'
import { previewWishlist } from '../lib/wishlist'

export function AmazonWishlistImport({
  library,
  onSave,
}: {
  library: Library
  onSave: (next: Library) => boolean
}) {
  const [url, setUrl] = useState(''),
    [text, setText] = useState(''),
    [filename, setFilename] = useState('')
  const [parsed, setParsed] = useState<AmazonList | null>(null),
    [error, setError] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const selected = parsed?.items.filter((item) => item.selected) || []
  const preview = useMemo(
    () =>
      parsed
        ? previewWishlist(
            parsed.items.filter((item) => item.selected),
            library,
          )
        : null,
    [parsed, library],
  )
  function parse(input: string) {
    setError('')
    setParsed(null)
    setReviewed(false)
    try {
      const result =
        /<a\b[^>]*\bid\s*=\s*["']itemName_/i.test(input) || /^\s*(?:<!doctype|<html)/i.test(input)
          ? parseAmazonHtml(input)
          : parseAmazonText(input)
      if (url.trim()) {
        const canonical = amazonListUrl(url)
        result.items = result.items.map((item) => ({
          ...item,
          sourceMetadata: { ...item.sourceMetadata, 'Amazon wishlist URL': canonical },
        }))
      }
      setParsed(result)
      if (/<[a-z][\s\S]*>/i.test(input)) setText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this Amazon list.')
    }
  }
  return (
    <section className="amazon-import">
      <p>
        Open your Amazon list in <strong>list view</strong>, scroll until all items have loaded,
        then save the page as HTML or copy its book list below. This imports the copy you provide;
        it does not sync with Amazon.
      </p>
      <label>
        Amazon wishlist link (optional)
        <input
          type="url"
          value={url}
          placeholder="https://www.amazon.com/hz/wishlist/ls/…"
          onChange={(e) => {
            setUrl(e.target.value)
            setParsed(null)
            setReviewed(false)
          }}
        />
      </label>
      <button
        disabled={!url.trim()}
        onClick={() => {
          try {
            window.open(amazonListUrl(url), '_blank', 'noopener,noreferrer')
            setError('')
          } catch (e) {
            setError((e as Error).message)
          }
        }}
      >
        Open Amazon list
      </button>
      <label className="file-label">
        <Upload size={16} /> Choose saved Amazon page
        <input
          aria-label="Choose saved Amazon page"
          type="file"
          accept=".html,.htm,text/html"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            setParsed(null)
            setReviewed(false)
            setText('')
            setFilename('')
            setError('')
            try {
              if (file.size > 20_000_000)
                throw new Error('Choose a saved HTML page smaller than 20 MB.')
              const input = await file.text()
              setFilename(file.name)
              parse(input)
            } catch (error) {
              setError((error as Error).message)
            }
          }}
        />
      </label>
      {filename && <p className="muted">{filename}</p>}
      <label>
        Or paste the Amazon book list
        <textarea
          rows={5}
          value={text}
          maxLength={2000000}
          placeholder={'Book title\nby Author Name (Paperback)'}
          onChange={(e) => {
            setText(e.target.value)
            setParsed(null)
            setFilename('')
            setReviewed(false)
          }}
        />
      </label>
      <button disabled={!text.trim()} onClick={() => parse(text)}>
        Preview Amazon list
      </button>
      <p className="muted">
        A link alone cannot retrieve the list here. Saved HTML usually retains product IDs and
        covers; copied text includes only recognized title/author lines. Amazon ratings and prices
        are not imported as your own ratings.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {parsed && preview && (
        <section className="import-review" aria-label="Amazon import preview">
          <h3>{parsed.name}</h3>
          <p>
            {parsed.items.length} entries found · {selected.length} selected · {preview.added} new
            books · {preview.updated} existing books to update
          </p>
          <p>
            Check the count against Amazon. A saved or copied page may contain only the items that
            had loaded. Unidentified or unsupported formats start unchecked.
          </p>
          <div className="wishlist-actions">
            <button
              onClick={() => {
                setParsed({
                  ...parsed,
                  items: parsed.items.map((item) => ({
                    ...item,
                    selected: !item.warning || item.warning === 'Author not supplied by Amazon.',
                  })),
                })
                setReviewed(false)
              }}
            >
              Select recognized books
            </button>
            <button
              onClick={() => {
                setParsed({
                  ...parsed,
                  items: parsed.items.map((item) => ({ ...item, selected: false })),
                })
                setReviewed(false)
              }}
            >
              Clear selection
            </button>
          </div>
          <ul className="amazon-items">
            {parsed.items.map((item, index) => (
              <li key={index}>
                <label>
                  <input
                    type="checkbox"
                    disabled={item.warning.startsWith('Unsupported format:')}
                    checked={item.selected}
                    onChange={(e) => {
                      setParsed({
                        ...parsed,
                        items: parsed.items.map((entry, i) =>
                          i === index ? { ...entry, selected: e.target.checked } : entry,
                        ),
                      })
                      setReviewed(false)
                    }}
                  />
                  <span>
                    <strong>{item.title}</strong>
                    <br />
                    {item.author || 'Author not supplied'} · {item.format}
                    <br />
                    {item.warning && <span className="amazon-warning">{item.warning} </span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {preview.entries.some((entry) => entry.action === 'Needs review') && (
            <p>
              Some titles match multiple library records and will be skipped:{' '}
              {preview.entries
                .filter((entry) => entry.action === 'Needs review')
                .map((entry) => entry.title)
                .join('; ')}
              .
            </p>
          )}
          <p>
            {preview.entries.filter((entry) => entry.action === 'Already listed').length} selected
            entries are already on your wishlist and will be skipped.
          </p>
          <label className="amazon-confirm">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />{' '}
            I have checked the selected books and the item count.
          </label>
          <button
            className="primary"
            disabled={!reviewed || (!preview.added && !preview.updated)}
            onClick={() => {
              if (!onSave(preview.library))
                setError(
                  'Could not save. Your preview is still here; browser storage may be full or unavailable.',
                )
            }}
          >
            Import {preview.added + preview.updated} books from Amazon
          </button>
        </section>
      )}
    </section>
  )
}
