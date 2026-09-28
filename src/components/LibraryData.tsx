import { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { type Library } from '../lib/model'
import { downloadJson, importLogos, parseBackup } from '../lib/storage'
import { Modal } from './Modal'
export function LibraryData({
  library,
  onSave,
  onClose,
}: {
  library: Library
  onSave: (library: Library) => boolean
  onClose: () => void
}) {
  const [pending, setPending] = useState<Library | null>(null),
    [message, setMessage] = useState(''),
    [error, setError] = useState('')
  async function read(file: File | undefined, type: 'logos' | 'backup') {
    if (!file) return
    setError('')
    setPending(null)
    try {
      if (file.size > 20_000_000) throw new Error('Please choose a JSON file smaller than 20 MB.')
      const input: unknown = JSON.parse(await file.text())
      if (type === 'logos') {
        const result = importLogos(input, library)
        setPending(result.library)
        setMessage(
          `${result.added} resources to add; ${result.skipped} existing resources left unchanged.${library.sample ? ' Illustrative samples will be removed; your added books will stay.' : ''}`,
        )
      } else {
        const parsed = parseBackup(input)
        setPending(parsed)
        setMessage(
          `Restore ${parsed.books.length} books, ${parsed.series.length} series, and ${parsed.loans.length} loans. This replaces the current library on this device.`,
        )
      }
    } catch (e) {
      setError(
        e instanceof Error && e.name !== 'ZodError'
          ? e.message
          : 'This file does not match the supported catalog or backup format. Nothing was changed.',
      )
    }
  }
  return (
    <Modal title="Your library data" onClose={onClose}>
      <p className="muted">
        Saved in this browser on this device. Export a backup to keep a copy or move to another
        device. There is no account or cloud sync in v0.1.
      </p>
      <button onClick={() => downloadJson(library, 'ministry-study.backup.json')}>
        <Download size={16} /> Export backup
      </button>
      <section className="detail-section">
        <h3>Import Logos catalog</h3>
        <p>
          Choose the project’s <strong>logos-library-inventory.json</strong>. Original metadata and
          permanent / temporary licenses are preserved. Existing resources are skipped by resource
          ID.
        </p>
        <label className="file-label">
          <Upload size={16} /> Choose Logos JSON
          <input
            aria-label="Choose Logos JSON"
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              void read(e.target.files?.[0], 'logos')
              e.target.value = ''
            }}
          />
        </label>
      </section>
      <section className="detail-section">
        <h3>Restore a backup</h3>
        <p>
          Use a backup exported by Ministry Study. Export your current library first if you want to
          keep both.
        </p>
        <label className="file-label">
          <Upload size={16} /> Choose backup
          <input
            aria-label="Choose backup"
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              void read(e.target.files?.[0], 'backup')
              e.target.value = ''
            }}
          />
        </label>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <div className="import-review">
          <p>{message}</p>
          <button
            className="primary"
            onClick={() => {
              if (!onSave(pending))
                setError(
                  'Could not save the import. Browser storage may be full or unavailable. Export your current library and try again.',
                )
            }}
          >
            Confirm import
          </button>
        </div>
      )}
      <section className="detail-section">
        <h3>Start your own library</h3>
        <p>Remove the illustrative samples and begin with an empty library.</p>
        <button
          disabled={!library.sample || library.books.some((b) => !b.id.startsWith('sample-'))}
          onClick={() => {
            setPending({ version: 1, books: [], series: [], loans: [], sample: false })
            setMessage('Remove all illustrative samples and start an empty library.')
          }}
        >
          Start empty
        </button>
      </section>
    </Modal>
  )
}
