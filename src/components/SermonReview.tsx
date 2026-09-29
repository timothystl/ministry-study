import { useMemo, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import type { Library } from '../lib/model'
import {
  applyReview,
  buildReviewPackage,
  catalogCsv,
  FIELD_LABEL,
  parseReview,
  planReview,
  type ReviewPlan,
} from '../lib/sermonReview'
import { downloadBlob } from '../lib/sermonText'
import { Modal } from './Modal'

type Filter = 'all' | 'fills' | 'overwrites' | 'warnings'
// Step 1 gives a reader (such as Claude Cowork) the catalog, the manuscripts and instructions.
// Step 2 reads back what it proposes and shows every change beside the current value for
// approval. Nothing changes until it is approved, and replaced titles are kept.
export function SermonReview({
  library,
  onSave,
  onClose,
}: {
  library: Library
  onSave: (library: Library) => boolean
  onClose: () => void
}) {
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<ReviewPlan | null>(null)
  const [accepted, setAccepted] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<Filter>('all')
  const [limit, setLimit] = useState(50)
  const [done, setDone] = useState('')

  async function download() {
    setBusy('Preparing the review package…')
    setError('')
    try {
      const { zip, withText, note } = await buildReviewPackage(library.sermons, setBusy)
      downloadBlob(zip, 'sermon-review-package.zip', 'application/zip')
      setNote(`Downloaded with ${withText} manuscripts. ${note}`.trim())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy('')
    }
  }
  async function read(file: File | undefined) {
    if (!file) return
    setError('')
    setDone('')
    setPlan(null)
    try {
      if (file.size > 20_000_000) throw new Error('Please choose a file smaller than 20 MB.')
      const next = planReview(parseReview(await file.text()), library)
      setPlan(next)
      // Additions are accepted to start with; replacing something already filled in is not.
      setAccepted(
        new Set(
          next.reviews.flatMap((r) => r.changes.filter((c) => c.kind === 'fill').map((c) => c.key)),
        ),
      )
      setLimit(50)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this file.')
    }
  }
  const all = useMemo(() => plan?.reviews.flatMap((r) => r.changes) ?? [], [plan])
  const shown = useMemo(
    () =>
      (plan?.reviews ?? []).filter(
        (r) =>
          filter === 'all' ||
          (filter === 'fills' && r.changes.some((c) => c.kind === 'fill')) ||
          (filter === 'overwrites' && r.changes.some((c) => c.kind === 'overwrite')) ||
          (filter === 'warnings' && r.warnings.length > 0),
      ),
    [plan, filter],
  )
  const toggle = (keys: string[], on: boolean) =>
    setAccepted((prev) => {
      const next = new Set(prev)
      for (const k of keys) {
        if (on) next.add(k)
        else next.delete(k)
      }
      return next
    })
  const fills = all.filter((c) => c.kind === 'fill')
  const overwrites = all.filter((c) => c.kind === 'overwrite')
  return (
    <Modal title="Review sermons" onClose={onClose} wide>
      <section className="detail-section">
        <h3>1. Send the sermons for review</h3>
        <p>
          Download a package with your catalog, the saved manuscripts, and instructions for the
          reader (the instructions say exactly what to return). Give it to Claude Cowork or anyone
          else who will read the sermons. It contains your sermons, so keep it private.
        </p>
        <div className="sermon-actions">
          <button onClick={() => void download()} disabled={Boolean(busy)}>
            <Download size={16} /> Download review package
          </button>
          <button
            onClick={() =>
              downloadBlob(
                new TextEncoder().encode(catalogCsv(library.sermons)),
                'sermon-catalog.csv',
                'text/csv',
              )
            }
          >
            <Download size={16} /> Catalog only (CSV)
          </button>
        </div>
        {busy && <p role="status">{busy}</p>}
        {note && <p role="status">{note}</p>}
      </section>
      <section className="detail-section">
        <h3>2. Approve what comes back</h3>
        <p>
          Choose the review.csv you get back. You will see each proposed change beside what is there
          now. Nothing changes until you approve it.
        </p>
        <label className="file-label">
          <Upload size={16} /> Choose review.csv
          <input
            aria-label="Choose review file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              void read(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {done && <p role="status">{done}</p>}
        {plan && (
          <div className="import-review" aria-label="Proposed changes">
            <p>
              {plan.reviews.length} sermons with proposals: {fills.length} additions to empty fields
              and {overwrites.length} replacements of what is there now.
              {plan.unchanged > 0 && ` ${plan.unchanged} sermons had nothing new.`}
              {plan.unmatched.length > 0 && ` ${plan.unmatched.length} rows matched no sermon.`}
            </p>
            <div className="sermon-actions">
              <button onClick={() => setAccepted(new Set(fills.map((c) => c.key)))}>
                Approve only additions
              </button>
              <button onClick={() => setAccepted(new Set(all.map((c) => c.key)))}>
                Approve everything
              </button>
              <button onClick={() => setAccepted(new Set())}>Approve nothing</button>
              <label>
                Show{' '}
                <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
                  <option value="all">All sermons</option>
                  <option value="fills">With additions</option>
                  <option value="overwrites">With replacements</option>
                  <option value="warnings">With warnings</option>
                </select>
              </label>
            </div>
            <ul className="review-list">
              {shown.slice(0, limit).map((r) => (
                <li key={r.sermon.id} className="review-item">
                  <div className="review-head">
                    <strong>{r.sermon.title}</strong>
                    <span className="muted">
                      {[r.sermon.scripture, r.sermon.date].filter(Boolean).join(' · ')}
                    </span>
                    {r.changes.length > 1 && (
                      <button
                        onClick={() =>
                          toggle(
                            r.changes.map((c) => c.key),
                            !r.changes.every((c) => accepted.has(c.key)),
                          )
                        }
                      >
                        {r.changes.every((c) => accepted.has(c.key))
                          ? 'Clear this sermon'
                          : 'Approve this sermon'}
                      </button>
                    )}
                  </div>
                  {r.note && <p className="muted">{r.note}</p>}
                  {r.changes.map((c) => (
                    <label key={c.key} className="review-change">
                      <input
                        type="checkbox"
                        checked={accepted.has(c.key)}
                        onChange={(e) => toggle([c.key], e.target.checked)}
                      />
                      <span>
                        <strong>{FIELD_LABEL[c.field]}</strong>{' '}
                        <em>{c.kind === 'fill' ? 'adds' : 'replaces'}</em>
                        {c.kind === 'overwrite' && <span className="review-from">{c.from}</span>}
                        <span className="review-to">{c.to}</span>
                      </span>
                    </label>
                  ))}
                  {r.warnings.map((w) => (
                    <p key={w} className="muted">
                      {w}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
            {shown.length > limit && (
              <button onClick={() => setLimit(limit + 50)}>
                Show more ({shown.length - limit} remaining)
              </button>
            )}
            <button
              className="primary"
              disabled={!accepted.size}
              onClick={() => {
                if (!onSave(applyReview(library, plan, accepted)))
                  return setError('Could not save the changes. Nothing was changed.')
                setDone(`Applied ${accepted.size} approved changes.`)
                setPlan(null)
              }}
            >
              Apply {accepted.size} approved changes
            </button>
          </div>
        )}
      </section>
    </Modal>
  )
}
