import { useState, type FormEvent } from 'react'
import {
  type Book,
  type Library,
  type Location,
  ownerships,
  readingStatuses,
  formats,
  saveBook,
} from '../lib/model'
import { Modal } from './Modal'
import { CoverSearch } from './CoverSearch'
export function BookEditor({
  book,
  library,
  onSave,
  onClose,
}: {
  book: Book
  library: Library
  onSave: (library: Library) => boolean
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Book>({
    ...structuredClone(book),
    edition: book.edition ?? book.sourceMetadata?.Edition ?? '',
  })
  const [series, setSeries] = useState(
    library.series.find((s) => s.id === book.seriesId)?.name || '',
  )
  const [topics, setTopics] = useState(book.topics.join('; '))
  const [error, setError] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    try {
      if (
        !onSave(
          saveBook(
            library,
            {
              ...draft,
              topics: topics
                .split(';')
                .map((s) => s.trim())
                .filter(Boolean),
            },
            series,
          ),
        )
      )
        setError(
          'Could not save. Browser storage may be full or unavailable. Your changes are still in this form.',
        )
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const field = (
    key: 'title' | 'author' | 'publisher' | 'year' | 'isbn' | 'volume',
    label: string,
  ) => (
    <label>
      {label}
      <input
        required={key === 'title'}
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      />
    </label>
  )
  const loc = (key: 'location' | 'recommendedLocation') =>
    (['room', 'bookcase', 'shelf', 'position'] as (keyof Location)[]).map((k) => (
      <label key={k}>
        {k === 'room' ? 'Room / area' : k[0].toUpperCase() + k.slice(1)}
        <input
          value={draft[key][k]}
          onChange={(e) => setDraft({ ...draft, [key]: { ...draft[key], [k]: e.target.value } })}
        />
      </label>
    ))
  return (
    <Modal
      wide
      title={library.books.some((b) => b.id === book.id) ? 'Edit book' : 'Add a book'}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="form-grid">
          {field('title', 'Title')}
          {field('author', 'Author / contributors')}
          <label className="span-two">
            Subtitle
            <input
              value={draft.subtitle || ''}
              onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
            />
          </label>
          <label className="span-two">
            Cover image URL (HTTPS)
            <input
              type="url"
              placeholder="https://…"
              value={draft.coverUrl?.startsWith('/assets/') ? '' : draft.coverUrl || ''}
              onChange={(e) =>
                setDraft({ ...draft, coverUrl: e.target.value, coverSource: undefined })
              }
            />
          </label>
          <details className="span-two">
            <summary>Find a cover online</summary>
            <CoverSearch
              book={draft}
              onSelect={(candidate) => {
                setDraft({
                  ...draft,
                  coverUrl: candidate.imageUrl,
                  coverSource: {
                    name: 'Open Library',
                    url: candidate.sourceUrl,
                    selectedAt: new Date().toISOString(),
                  },
                })
              }}
            />
            {draft.coverSource && (
              <p role="status">
                Selected cover from {draft.coverSource.name}. Save book to keep it.
              </p>
            )}
          </details>
          {field('publisher', 'Publisher')}
          {field('year', 'Publication year')}
          <label>
            Edition
            <input
              value={draft.edition || ''}
              onChange={(e) => setDraft({ ...draft, edition: e.target.value })}
              placeholder="e.g. 2nd edition"
            />
          </label>
          {field('isbn', 'ISBN / identifier')}
          <label>
            Format
            <select
              value={draft.format}
              onChange={(e) => setDraft({ ...draft, format: e.target.value as Book['format'] })}
            >
              {formats.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Series
            <input list="series-names" value={series} onChange={(e) => setSeries(e.target.value)} />
            <datalist id="series-names">
              {library.series.map((s) => (
                <option key={s.id}>{s.name}</option>
              ))}
            </datalist>
          </label>
          {field('volume', 'Series volume')}
          <label className="span-two">
            Topics (separate with semicolons)
            <input value={topics} onChange={(e) => setTopics(e.target.value)} />
          </label>
        </div>
        <fieldset>
          <legend>Your relationship</legend>
          <div className="form-grid">
            <label>
              Ownership
              <select
                value={draft.ownership}
                onChange={(e) =>
                  setDraft({ ...draft, ownership: e.target.value as Book['ownership'] })
                }
              >
                {ownerships.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Reading status
              <select
                value={draft.reading.status}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    reading: {
                      ...draft.reading,
                      status: e.target.value as Book['reading']['status'],
                    },
                  })
                }
              >
                {readingStatuses.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Started
              <input
                type="date"
                value={draft.reading.started}
                onChange={(e) =>
                  setDraft({ ...draft, reading: { ...draft.reading, started: e.target.value } })
                }
              />
            </label>
            <label>
              Finished
              <input
                type="date"
                min={draft.reading.started || undefined}
                value={draft.reading.finished}
                onChange={(e) =>
                  setDraft({ ...draft, reading: { ...draft.reading, finished: e.target.value } })
                }
              />
            </label>
            <label>
              Rating
              <select
                value={draft.reading.rating}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    reading: { ...draft.reading, rating: Number(e.target.value) },
                  })
                }
              >
                <option value="0">Not rated</option>
                {[1, 2, 3, 4, 5].map((x) => (
                  <option key={x} value={x}>
                    {x} / 5
                  </option>
                ))}
              </select>
            </label>
            <label>
              Reading / borrowing source
              <input
                placeholder="e.g. Seminary library"
                value={draft.reading.source}
                onChange={(e) =>
                  setDraft({ ...draft, reading: { ...draft.reading, source: e.target.value } })
                }
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={draft.wishlist}
                onChange={(e) => setDraft({ ...draft, wishlist: e.target.checked })}
              />{' '}
              On my wishlist
            </label>
          </div>
        </fieldset>
        {draft.format === 'Physical' && (
          <>
            <fieldset>
              <legend>Current physical location</legend>
              {book.verification?.status === 'Confirmed' && (
                <p className="muted">
                  Changing the book’s identity or current location will mark it Not checked until
                  you verify it again.
                </p>
              )}
              <p className="muted">Where this copy belongs. Loan records track who has it.</p>
              <div className="form-grid">{loc('location')}</div>
            </fieldset>
            <details>
              <summary>Recommended physical organization</summary>
              <p className="muted">
                Optional future placement. Saving a recommendation does not move the book.
              </p>
              <div className="form-grid">{loc('recommendedLocation')}</div>
            </details>
          </>
        )}
        <label>
          Personal notes
          <textarea
            rows={4}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </label>
        <label>
          Summary
          <textarea
            rows={3}
            value={draft.summary}
            onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
          />
        </label>
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            Save book
          </button>
        </div>
      </form>
    </Modal>
  )
}
