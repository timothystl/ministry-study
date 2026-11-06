import { useId, useMemo, useState, type FormEvent } from 'react'
import { Copy, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { searchBooks, type Book, type Library } from '../lib/model'
import {
  blankSource,
  cite,
  citationStyles,
  html,
  listHeading,
  loadList,
  missing,
  plainText,
  rtfDocument,
  saveList,
  sortSources,
  sourceFromBook,
  sourceKinds,
  usesNotes,
  type CitationStyle,
  type Formatted,
  type Source,
  type SourceKind,
} from '../lib/citations'
import { Modal } from './Modal'

export function Rendered({ text }: { text: Formatted }) {
  return (
    <>{text.map((p, i) => (p.italic ? <i key={i}>{p.text}</i> : <span key={i}>{p.text}</span>))}</>
  )
}

// Copies with italics kept where the receiving program understands them (Word, Pages, Google
// Docs, email), and as plain text everywhere else.
async function copyFormatted(lines: Formatted[]) {
  const htmlText = lines.map((l) => `<p>${html(l)}</p>`).join('')
  const plain = lines.map(plainText).join('\n\n')
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([htmlText], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ])
      return true
    }
    await navigator.clipboard.writeText(plain)
    return true
  } catch {
    return false
  }
}

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/rtf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function StylePicker({
  style,
  onChange,
}: {
  style: CitationStyle
  onChange: (s: CitationStyle) => void
}) {
  return (
    <label className="bib-style">
      Citation style
      <select value={style} onChange={(e) => onChange(e.target.value as CitationStyle)}>
        {citationStyles.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function CopyButton({ lines, label }: { lines: Formatted[]; label: string }) {
  const [state, setState] = useState('')
  return (
    <button
      type="button"
      onClick={async () => {
        setState((await copyFormatted(lines)) ? 'Copied' : 'Could not copy')
        setTimeout(() => setState(''), 2000)
      }}
    >
      <Copy size={14} />
      {state || label}
    </button>
  )
}

function Field({
  label,
  value,
  onChange,
  hint,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
  type?: string
}) {
  const id = useId()
  return (
    <div className="bib-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <span id={`${id}-hint`} className="muted bib-hint">
          {hint}
        </span>
      )}
    </div>
  )
}

function SourceEditor({
  source,
  style,
  onSave,
  onClose,
}: {
  source: Source
  style: CitationStyle
  onSave: (s: Source) => void
  onClose: () => void
}) {
  const [s, setS] = useState(source)
  const set = (key: keyof Source) => (v: string) => setS((x) => ({ ...x, [key]: v }))
  const c = cite(s, style)
  const book = s.kind === 'Book',
    chapter = s.kind === 'Chapter in an edited book',
    article = s.kind === 'Journal article',
    web = s.kind === 'Website'
  function submit(e: FormEvent) {
    e.preventDefault()
    onSave(s)
  }
  return (
    <Modal title={source.title ? 'Edit source' : 'Add a source'} onClose={onClose} wide>
      <form onSubmit={submit} className="bib-editor">
        <label>
          Kind of source
          <select
            value={s.kind}
            onChange={(e) => setS({ ...s, kind: e.target.value as SourceKind })}
          >
            {sourceKinds.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <Field
          label={web ? 'Author (if named)' : 'Author(s)'}
          value={s.authors}
          onChange={set('authors')}
          hint="Separate several people with semicolons, e.g. John Stott; N. T. Wright"
        />
        <div className="form-grid">
          <Field
            label={
              chapter ? 'Chapter title' : article ? 'Article title' : web ? 'Page title' : 'Title'
            }
            value={s.title}
            onChange={set('title')}
          />
          <Field label="Subtitle" value={s.subtitle} onChange={set('subtitle')} />
        </div>
        {(chapter || article || web) && (
          <Field
            label={chapter ? 'Book title' : article ? 'Journal' : 'Website name'}
            value={s.container}
            onChange={set('container')}
          />
        )}
        {(book || chapter) && (
          <div className="form-grid">
            <Field
              label={chapter ? 'Editor(s) of the book' : 'Editor(s)'}
              value={s.editors}
              onChange={set('editors')}
              hint={
                book ? 'For a book with no author, the editors take the author’s place.' : undefined
              }
            />
            <Field label="Translator(s)" value={s.translator} onChange={set('translator')} />
          </div>
        )}
        {(book || chapter) && (
          <div className="form-grid">
            <Field
              label="Edition"
              value={s.edition}
              onChange={set('edition')}
              hint="e.g. 2 or Revised"
            />
            {book && <Field label="Volume" value={s.volume} onChange={set('volume')} />}
            <Field label="Series" value={s.series} onChange={set('series')} />
            <Field label="Number in series" value={s.seriesNumber} onChange={set('seriesNumber')} />
          </div>
        )}
        {(book || chapter) && (
          <div className="form-grid">
            <Field
              label="Place of publication"
              value={s.place}
              onChange={set('place')}
              hint="Chicago, Turabian and SBL use it; MLA and APA leave it out."
            />
            <Field label="Publisher" value={s.publisher} onChange={set('publisher')} />
          </div>
        )}
        {article && (
          <div className="form-grid">
            <Field label="Volume" value={s.volume} onChange={set('volume')} />
            <Field label="Issue" value={s.issue} onChange={set('issue')} />
          </div>
        )}
        <div className="form-grid">
          <Field label={web ? 'Date published' : 'Year'} value={s.year} onChange={set('year')} />
          {(chapter || article) && (
            <Field label="Pages" value={s.pages} onChange={set('pages')} hint="e.g. 52–74" />
          )}
          {!web && (
            <Field
              label="Page cited"
              value={s.cited}
              onChange={set('cited')}
              hint="For the footnote or in-text citation."
            />
          )}
        </div>
        {(web || article) && (
          <div className="form-grid">
            <Field label="Web address" value={s.url} onChange={set('url')} />
            {web && <Field label="Date accessed" value={s.accessed} onChange={set('accessed')} />}
          </div>
        )}
        <Field
          label="Short title (optional)"
          value={s.shortTitle}
          onChange={set('shortTitle')}
          hint="Used in later notes; otherwise the first few words of the title."
        />
        <div className="bib-preview" aria-label="Preview">
          <p className="bib-entry">
            <Rendered text={c.entry} />
          </p>
        </div>
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary">Save source</button>
        </div>
      </form>
    </Modal>
  )
}

export function Bibliography({ library }: { library: Library }) {
  const [list, setList] = useState(loadList)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<SourceKind>('Book')
  const [editing, setEditing] = useState<Source | null>(null)
  const [error, setError] = useState('')
  const { style, sources } = list
  function update(next: typeof list) {
    setList(next)
    setError(saveList(next) ? '' : 'Could not keep this list on this device. Copy or download it.')
  }
  const results = useMemo(
    () => (query.trim() ? searchBooks(library, query).slice(0, 8) : []),
    [library, query],
  )
  const added = new Set(sources.map((s) => s.bookId).filter(Boolean))
  const citations = sources.map((s) => ({ source: s, c: cite(s, style) }))
  const sorted = sortSources(sources).map((s) => cite(s, style).entry)
  const notes = usesNotes(style)
  const heading = listHeading(style)
  function save(s: Source) {
    const exists = sources.some((x) => x.id === s.id)
    update({
      ...list,
      sources: exists ? sources.map((x) => (x.id === s.id ? s : x)) : [...sources, s],
    })
    setEditing(null)
  }
  function addBook(b: Book) {
    update({ ...list, sources: [...sources, sourceFromBook(b, library)] })
  }
  return (
    <section className="sermons bibliography">
      <div className="sermons-head">
        <div>
          <h1>Bibliography & Citations</h1>
          <p className="muted">
            Gather sources from your library or type them in, then copy a finished bibliography and
            footnotes in the style you need.
          </p>
        </div>
        <StylePicker style={style} onChange={(next) => update({ ...list, style: next })} />
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="research-layout">
        <div className="research-main">
          <h2>Sources ({sources.length})</h2>
          {!sources.length ? (
            <p className="muted">
              No sources yet. Find a book from your library or add one by hand.
            </p>
          ) : (
            <ol className="bib-sources">
              {citations.map(({ source, c }) => {
                const needs = missing(source, style)
                return (
                  <li key={source.id}>
                    <p className="bib-entry">
                      <Rendered text={c.entry} />
                    </p>
                    {needs.length > 0 && <p className="bib-missing">Missing: {needs.join(', ')}</p>}
                    <div className="sermon-actions">
                      <button
                        type="button"
                        className="small-button"
                        onClick={() => setEditing(source)}
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      <button
                        type="button"
                        className="small-button"
                        aria-label={`Remove ${source.title || 'source'}`}
                        onClick={() =>
                          update({ ...list, sources: sources.filter((x) => x.id !== source.id) })
                        }
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}

          {sources.length > 0 && (
            <>
              <div className="bib-output-head">
                <h2>{heading}</h2>
                <div className="sermon-actions">
                  <CopyButton lines={sorted} label={`Copy ${heading.toLowerCase()}`} />
                  <button
                    type="button"
                    onClick={() =>
                      download(
                        rtfDocument(
                          heading,
                          sorted,
                          notes
                            ? { heading: 'Notes', items: citations.map(({ c }) => c.note!) }
                            : undefined,
                        ),
                        `${heading.toLowerCase().replace(/\s+/g, '-')}.rtf`,
                      )
                    }
                  >
                    <Download size={14} /> Download for Word
                  </button>
                </div>
              </div>
              <div className="bib-output" aria-label={heading}>
                {sorted.map((e, i) => (
                  <p key={i} className="bib-entry">
                    <Rendered text={e} />
                  </p>
                ))}
              </div>
              {style === 'apa' && (
                <p className="muted bib-hint">
                  APA writes titles of books, chapters and articles in sentence case (only the first
                  word, the first word after a colon, and proper nouns capitalized). Edit a title if
                  it needs it.
                </p>
              )}

              <div className="bib-output-head">
                <h2>{notes ? 'Footnotes' : 'In-text citations'}</h2>
                <CopyButton
                  lines={citations.map(({ c }) => (notes ? c.note! : c.inText!))}
                  label={notes ? 'Copy first notes' : 'Copy citations'}
                />
              </div>
              {notes ? (
                <ol className="bib-notes">
                  {citations.map(({ source, c }) => (
                    <li key={source.id}>
                      <p>
                        <Rendered text={c.note!} />
                      </p>
                      <p className="muted">
                        Later notes: <Rendered text={c.shortNote!} />
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <ul className="bib-notes">
                  {citations.map(({ source, c }) => (
                    <li key={source.id}>
                      <Rendered text={c.inText!} /> <span className="muted">— {source.title}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="sermon-actions bib-clear">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Clear every source from this list?'))
                      update({ ...list, sources: [] })
                  }}
                >
                  <Trash2 size={14} /> Clear list
                </button>
              </div>
            </>
          )}
        </div>
        <aside className="research-side">
          <h2>Add from your library</h2>
          <div className="search-bar">
            <Search size={18} />
            <input
              aria-label="Find a book to cite"
              placeholder="Title, author, topic…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {query.trim() && !results.length && <p className="muted">No books match.</p>}
          <ul className="research-list">
            {results.map((b) => (
              <li key={b.id} className="bib-result">
                <span>
                  <strong>{b.title}</strong>
                  <span className="muted"> {[b.author, b.year].filter(Boolean).join(' · ')}</span>
                </span>
                <button
                  type="button"
                  className="small-button"
                  disabled={added.has(b.id)}
                  aria-label={`Add ${b.title}`}
                  onClick={() => addBook(b)}
                >
                  {added.has(b.id) ? (
                    'Added'
                  ) : (
                    <>
                      <Plus size={13} /> Add
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <h2>Add by hand</h2>
          <label className="bib-style">
            Kind of source
            <select value={kind} onChange={(e) => setKind(e.target.value as SourceKind)}>
              {sourceKinds.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="primary bib-add"
            onClick={() => setEditing(blankSource(kind))}
          >
            <Plus size={14} /> Add a source
          </button>
          <p className="muted bib-hint">
            This list is kept in this browser. Books from your library stay linked to their record
            here, but edits you make here do not change the library.
          </p>
        </aside>
      </div>
      {editing && (
        <SourceEditor
          source={editing}
          style={style}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  )
}

// "Cite this book" from a book's page: every style at a glance, and a way to add it to the list.
export function CiteBook({
  book,
  library,
  onClose,
}: {
  book: Book
  library: Library
  onClose: () => void
}) {
  const [list, setList] = useState(loadList)
  const [source, setSource] = useState(() => sourceFromBook(book, library))
  const [style, setStyle] = useState<CitationStyle>(list.style)
  const c = cite(source, style)
  const needs = missing(source, style)
  const inList = list.sources.some((s) => s.bookId === book.id)
  const notes = usesNotes(style)
  return (
    <Modal title="Cite this book" onClose={onClose} wide>
      <div className="bib-cite">
        <StylePicker style={style} onChange={setStyle} />
        <div className="form-grid">
          <Field
            label="Place of publication"
            value={source.place}
            onChange={(v) => setSource({ ...source, place: v })}
          />
          <Field
            label="Page cited"
            value={source.cited}
            onChange={(v) => setSource({ ...source, cited: v })}
          />
        </div>
        <h3>{listHeading(style)}</h3>
        <p className="bib-entry">
          <Rendered text={c.entry} />
        </p>
        {needs.length > 0 && <p className="bib-missing">Missing: {needs.join(', ')}</p>}
        <h3>{notes ? 'First note' : 'In-text citation'}</h3>
        <p>
          <Rendered text={notes ? c.note! : c.inText!} />
        </p>
        {notes && (
          <>
            <h3>Later notes</h3>
            <p>
              <Rendered text={c.shortNote!} />
            </p>
          </>
        )}
        <div className="form-actions">
          <CopyButton lines={[c.entry]} label="Copy entry" />
          <CopyButton
            lines={[notes ? c.note! : c.inText!]}
            label={notes ? 'Copy note' : 'Copy citation'}
          />
          <button
            type="button"
            className="primary"
            disabled={inList}
            onClick={() => {
              const next = { style, sources: [...list.sources, source] }
              if (saveList(next)) setList(next)
            }}
          >
            {inList ? 'In your bibliography' : 'Add to bibliography'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
