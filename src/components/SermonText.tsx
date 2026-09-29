import { useCallback, useEffect, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import type { Library } from '../lib/model'
import { parseSermonLine, previewSermonImport, type Sermon } from '../lib/sermons'
import {
  buildBackup,
  deleteSermonText,
  downloadBlob,
  getSermonText,
  matchFiles,
  putSermonText,
  readManuscript,
  setSermonIndexed,
  textStatus,
  type FileMatch,
  type Manuscript,
  type SavedText,
  type TextStatus,
} from '../lib/sermonText'
import { Modal } from './Modal'

interface Prepared {
  match: FileMatch
  manuscript: Manuscript
}
interface Plan {
  fresh: Prepared[]
  changed: Prepared[]
  unchanged: number
  unmatched: File[]
  duplicates: File[]
  unreadable: { name: string; reason: string }[]
}
const pool = async <T,>(items: T[], size: number, work: (item: T) => Promise<void>) => {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await work(items[next++])
    }),
  )
}

// Choose a folder or files of manuscripts; each is matched to a sermon, shown for review, then
// saved. Files are read in the browser and only their text is sent.
export function SermonTextManager({
  library,
  onSave,
  onClose,
}: {
  library: Library
  onSave: (library: Library) => boolean
  onClose: () => void
}) {
  const [status, setStatus] = useState<TextStatus[] | null | 'unavailable'>(null)
  const [files, setFiles] = useState<File[]>([])
  const [plan, setPlan] = useState<Plan | null>(null)
  const [reading, setReading] = useState(0)
  const [addUnmatched, setAddUnmatched] = useState(false)
  const [keepOut, setKeepOut] = useState(false)
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState('')
  const [failures, setFailures] = useState<string[]>([])
  const [error, setError] = useState('')
  const [backup, setBackup] = useState('')

  const refresh = useCallback(() => {
    textStatus()
      .then(setStatus)
      .catch(() => setStatus('unavailable'))
  }, [])
  useEffect(refresh, [refresh])

  async function choose(list: FileList | null) {
    const chosen = [...(list || [])].filter(
      (f) => /\.(docx|txt|md)$/i.test(f.name) && !f.name.startsWith('~$'),
    )
    setPlan(null)
    setResult('')
    setError('')
    setFailures([])
    setFiles(chosen)
    if (!chosen.length)
      return setError('No Word, text or Markdown files were found in that selection.')
    if (!Array.isArray(status)) return
    const known = new Map(status.map((s) => [s.id, s]))
    const { matched, unmatched, duplicates } = matchFiles(chosen, library.sermons)
    const next: Plan = {
      fresh: [],
      changed: [],
      unchanged: 0,
      unmatched,
      duplicates,
      unreadable: [],
    }
    setReading(0)
    let done = 0
    await pool(matched, 4, async (match) => {
      try {
        const manuscript = await readManuscript(match.file)
        const old = known.get(match.sermon.id)
        if (!old) next.fresh.push({ match, manuscript })
        else if (old.hash !== manuscript.hash) next.changed.push({ match, manuscript })
        else next.unchanged++
      } catch (e) {
        next.unreadable.push({ name: match.file.name, reason: (e as Error).message })
      }
      setReading(++done)
    })
    setReading(0)
    setPlan(next)
  }

  async function save() {
    if (!plan) return
    setError('')
    setResult('')
    setFailures([])
    let sermons: Sermon[] = library.sermons
    const extra: Prepared[] = []
    if (addUnmatched && plan.unmatched.length) {
      const rows = plan.unmatched.map((f) => parseSermonLine(f.name))
      const added = previewSermonImport(rows, library)
      if (!onSave(added.library)) return setError('Could not add the new sermon records.')
      sermons = added.library.sermons
      const fresh = matchFiles(
        plan.unmatched,
        sermons.filter((s) => !library.sermons.some((o) => o.id === s.id)),
      )
      for (const match of fresh.matched) {
        try {
          extra.push({ match, manuscript: await readManuscript(match.file) })
        } catch {
          /* unreadable files are reported at preview */
        }
      }
    }
    const work = [...plan.fresh, ...plan.changed, ...extra]
    setSaving({ done: 0, total: work.length })
    const failed: string[] = []
    let done = 0
    await pool(work, 4, async ({ match, manuscript }) => {
      const send = () =>
        putSermonText(match.sermon.id, {
          text: manuscript.text,
          hash: manuscript.hash,
          fileName: match.file.name,
          indexed: !keepOut,
        })
      try {
        try {
          await send()
        } catch {
          await send() // one retry for a dropped connection
        }
      } catch (e) {
        failed.push(`${match.file.name}: ${(e as Error).message}`)
      }
      setSaving({ done: ++done, total: work.length })
    })
    setSaving(null)
    setFailures(failed)
    setResult(
      `Saved ${work.length - failed.length} manuscripts${failed.length ? `; ${failed.length} did not save` : ''}.`,
    )
    setPlan(null)
    setFiles([])
    refresh()
  }

  async function download() {
    setBackup('Preparing…')
    try {
      const zip = await buildBackup(library.sermons, (n) => setBackup(`Gathered ${n} manuscripts…`))
      downloadBlob(zip, 'sermon-manuscripts.zip', 'application/zip')
      setBackup('Downloaded. Keep this file somewhere private.')
    } catch (e) {
      setBackup('')
      setError((e as Error).message)
    }
  }
  const saved = Array.isArray(status) ? status.length : 0
  const total = plan ? plan.fresh.length + plan.changed.length : 0
  return (
    <Modal title="Sermon manuscripts" onClose={onClose} wide>
      {status === 'unavailable' ? (
        <p className="error" role="alert">
          Saving manuscripts needs the shared library, and it is not available right now. Sign in to
          the shared library and try again.
        </p>
      ) : (
        <>
          <p>
            Save the full text of your sermons so they can be searched and kept as a backup. Files
            are read in your browser, and only their text is sent to your shared library. Your
            originals are not changed.
          </p>
          <p className="muted" role="status">
            {status === null
              ? 'Checking what is saved…'
              : `${saved} of ${library.sermons.length} sermons have saved text.`}
          </p>
          <div className="scan-typed">
            <label className="file-label">
              <Upload size={16} /> Choose a folder
              <input
                aria-label="Choose a folder of manuscripts"
                type="file"
                // @ts-expect-error webkitdirectory is supported by every current browser
                webkitdirectory=""
                multiple
                onChange={(e) => {
                  void choose(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
            <label className="file-label">
              <Upload size={16} /> Choose files
              <input
                aria-label="Choose manuscript files"
                type="file"
                multiple
                accept=".docx,.txt,.md"
                onChange={(e) => {
                  void choose(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          {reading > 0 && (
            <p role="status">
              Reading {reading} of {files.length}…
            </p>
          )}
          {plan && (
            <section className="import-review" aria-label="Manuscript review">
              <h3>Review before saving</h3>
              <ul>
                <li>{plan.fresh.length} new manuscripts to save</li>
                <li>{plan.changed.length} saved manuscripts that have changed</li>
                <li>{plan.unchanged} already saved and unchanged</li>
                {plan.unmatched.length > 0 && (
                  <li>{plan.unmatched.length} files that match no sermon in your catalog</li>
                )}
                {plan.duplicates.length > 0 && (
                  <li>{plan.duplicates.length} extra copies of a sermon (left out)</li>
                )}
                {plan.unreadable.length > 0 && (
                  <li>{plan.unreadable.length} files that could not be read</li>
                )}
              </ul>
              {plan.unmatched.length > 0 && (
                <>
                  <details>
                    <summary>Files that match no sermon</summary>
                    <ul>
                      {plan.unmatched.slice(0, 30).map((f) => (
                        <li key={f.name}>{f.name}</li>
                      ))}
                    </ul>
                  </details>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={addUnmatched}
                      onChange={(e) => setAddUnmatched(e.target.checked)}
                    />
                    Also add a sermon record for each of these files
                  </label>
                </>
              )}
              {plan.unreadable.length > 0 && (
                <details>
                  <summary>Files that could not be read</summary>
                  <ul>
                    {plan.unreadable.slice(0, 30).map((f) => (
                      <li key={f.name}>
                        {f.name}: {f.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <label className="check">
                <input
                  type="checkbox"
                  checked={keepOut}
                  onChange={(e) => setKeepOut(e.target.checked)}
                />
                Keep these out of search (the text is still saved for backup)
              </label>
              <button
                className="primary"
                disabled={!total && !(addUnmatched && plan.unmatched.length) && !saving}
                onClick={() => void save()}
              >
                Save {total + (addUnmatched ? plan.unmatched.length : 0)} manuscripts
              </button>
            </section>
          )}
          {saving && (
            <p role="status">
              Saving {saving.done} of {saving.total}…
            </p>
          )}
          {result && <p role="status">{result}</p>}
          {failures.length > 0 && (
            <details open>
              <summary>Some did not save. Choose the same folder again to retry them.</summary>
              <ul>
                {failures.slice(0, 20).map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </details>
          )}
          <section className="detail-section">
            <h3>Backup</h3>
            <p className="muted">
              Download every saved manuscript as a zip of plain text files. Keep it private.
            </p>
            <button onClick={() => void download()} disabled={!saved}>
              <Download size={16} /> Download all manuscripts
            </button>
            {backup && <p role="status">{backup}</p>}
          </section>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  )
}

// The saved manuscript on a sermon's own page.
export function ManuscriptSection({ sermon }: { sermon: Sermon }) {
  const [state, setState] = useState<'loading' | 'none' | 'unavailable' | SavedText>('loading')
  const [all, setAll] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    let live = true
    getSermonText(sermon.id)
      .then((found) => live && setState(found ?? 'none'))
      .catch(() => live && setState('unavailable'))
    return () => {
      live = false
    }
  }, [sermon.id])
  async function addFile(file: File | undefined) {
    if (!file) return
    setError('')
    try {
      const m = await readManuscript(file)
      await putSermonText(sermon.id, {
        text: m.text,
        hash: m.hash,
        fileName: file.name,
        indexed: true,
      })
      setState((await getSermonText(sermon.id)) ?? 'none')
    } catch (e) {
      setError((e as Error).message)
    }
  }
  if (state === 'unavailable') return null
  if (state === 'loading') return null
  return (
    <section className="detail-section" aria-label="Manuscript text">
      <h3>Manuscript text</h3>
      {state === 'none' ? (
        <p className="muted">No text is saved for this sermon yet.</p>
      ) : (
        <>
          <p className="muted">
            {state.chars.toLocaleString()} characters from {state.fileName || 'a file'}.
          </p>
          <pre className="manuscript">
            {all || state.text.length <= 4000 ? state.text : `${state.text.slice(0, 4000)}…`}
          </pre>
          <div className="sermon-actions">
            {state.text.length > 4000 && (
              <button onClick={() => setAll(!all)}>{all ? 'Show less' : 'Show all'}</button>
            )}
            <button
              onClick={() =>
                void navigator.clipboard?.writeText(state.text).then(() => setCopied(true))
              }
            >
              {copied ? 'Copied' : 'Copy text'}
            </button>
            <label className="check">
              <input
                type="checkbox"
                checked={state.indexed}
                onChange={(e) => {
                  const wanted = e.target.checked
                  setState({ ...state, indexed: wanted })
                  setSermonIndexed(sermon.id, wanted).catch((err: Error) => {
                    setState({ ...state, indexed: !wanted })
                    setError(err.message)
                  })
                }}
              />
              Include in search
            </label>
            <button
              onClick={() =>
                void deleteSermonText(sermon.id)
                  .then(() => setState('none'))
                  .catch((err: Error) => setError(err.message))
              }
            >
              Remove saved text
            </button>
          </div>
        </>
      )}
      <label className="file-label photo-label">
        <Upload size={15} /> {state === 'none' ? 'Add text from a file' : 'Replace from a file'}
        <input
          aria-label="Add manuscript text from a file"
          type="file"
          accept=".docx,.txt,.md"
          onChange={(e) => {
            void addFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
