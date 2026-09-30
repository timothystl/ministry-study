import { useState } from 'react'
import { HardDrive } from 'lucide-react'
import type { Library } from '../lib/model'
import {
  biggest,
  bytesLabel,
  loadUsage,
  plural,
  summaryLine,
  summarize,
  type Usage,
} from '../lib/usage'

// A readout of what is stored in the shared library, so it is clear where the space goes and where
// to cut back. Nothing is changed here; the biggest files are named so they can be found.
export function StorageUsage({ library }: { library: Library }) {
  const [usage, setUsage] = useState<Usage | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function check() {
    setBusy(true)
    setError('')
    try {
      setUsage(await loadUsage())
    } catch (e) {
      setError(
        `${(e as Error).message} The space readout needs the shared library; it is not available when running only in this browser.`,
      )
    }
    setBusy(false)
  }
  const sum = usage && summarize(usage)
  return (
    <section className="detail-section" aria-label="Storage used">
      <h3>Storage used</h3>
      <p className="muted">
        What is kept in the shared library: documents, images, music and video files, and the text
        of your catalog.
      </p>
      <button onClick={() => void check()} disabled={busy}>
        <HardDrive size={16} /> {usage ? 'Check again' : 'Check storage'}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {usage && sum && (
        <div role="status" aria-label="Storage summary">
          <p>
            <strong>{bytesLabel(sum.total)}</strong> in all. {summaryLine(sum.rows)}
          </p>
          <ul className="usage-rows">
            {sum.rows.map((r) => (
              <li key={r.kind}>
                <span>
                  {r.kind}: {r.count.toLocaleString()} {r.count === 1 ? 'file' : 'files'}
                </span>
                <strong>{bytesLabel(r.bytes)}</strong>
              </li>
            ))}
            <li>
              <span>Catalog and notes: {plural(usage.records.count, 'record')}</span>
              <strong>{bytesLabel(usage.records.bytes)}</strong>
            </li>
            <li>
              <span>Sermon manuscripts: {plural(usage.manuscripts.count, 'manuscript')}</span>
              <strong>{bytesLabel(usage.manuscripts.bytes)}</strong>
            </li>
          </ul>
          {usage.filesTruncated && (
            <p className="muted">There are more than 5,000 files, so these totals are partial.</p>
          )}
          {usage.files.length > 0 && (
            <>
              <h4>Biggest files</h4>
              <ul className="usage-rows">
                {biggest(usage, library).map((f) => (
                  <li key={f.id}>
                    <span>
                      {f.name}
                      <span className="muted"> · {f.owner}</span>
                    </span>
                    <strong>{bytesLabel(f.size)}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  )
}
