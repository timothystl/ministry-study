import { useState } from 'react'
import { Camera, FileText, Paperclip, Trash2 } from 'lucide-react'
import {
  attachFiles,
  attachmentUrl,
  isImageAttachment,
  removeFile,
  sizeLabel,
  type Attachment,
} from '../lib/attachments'

// Photos and PDFs on a record. Picking files uploads them straight away and then saves the record
// with the new list; removing one takes it off the record and deletes the stored copy.
export function Attachments({
  attachments,
  onChange,
  heading = 'Photos and PDFs',
}: {
  attachments: Attachment[]
  onChange: (next: Attachment[]) => boolean
  heading?: string
}) {
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [confirm, setConfirm] = useState('')
  async function add(list: FileList | null) {
    const files = [...(list || [])]
    if (!files.length) return
    setBusy(true)
    setErrors([])
    const { added, errors: problems } = await attachFiles(files)
    if (added.length && !onChange([...attachments, ...added])) {
      problems.push('The record could not be saved, so the files were not kept.')
      await Promise.all(added.map((a) => removeFile(a.id)))
    }
    setErrors(problems)
    setBusy(false)
  }
  function remove(a: Attachment) {
    if (onChange(attachments.filter((x) => x.id !== a.id))) void removeFile(a.id)
    setConfirm('')
  }
  return (
    <section className="detail-section" aria-label={heading}>
      <h3>{heading}</h3>
      {attachments.length === 0 && (
        <p className="muted">Nothing attached yet. Add a photo of a page, or a PDF.</p>
      )}
      {attachments.length > 0 && (
        <ul className="attachment-grid">
          {attachments.map((a) => (
            <li key={a.id}>
              <a
                href={attachmentUrl(a.id)}
                target="_blank"
                rel="noreferrer"
                className="attachment-open"
              >
                {isImageAttachment(a) ? (
                  <img src={attachmentUrl(a.id)} alt={a.name} loading="lazy" />
                ) : (
                  <span className="attachment-pdf">
                    <FileText size={34} />
                  </span>
                )}
                <span className="attachment-name">{a.name}</span>
              </a>
              <span className="muted">{sizeLabel(a.size)}</span>
              {confirm === a.id ? (
                <span>
                  <button onClick={() => remove(a)}>Yes, remove</button>{' '}
                  <button onClick={() => setConfirm('')}>Keep</button>
                </span>
              ) : (
                <button aria-label={`Remove ${a.name}`} onClick={() => setConfirm(a.id)}>
                  <Trash2 size={14} /> Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="scan-typed">
        <label className="file-label">
          <Paperclip size={16} /> Attach photos or PDFs
          <input
            aria-label="Attach photos or PDFs"
            type="file"
            multiple
            accept="image/*,application/pdf,.pdf"
            disabled={busy}
            onChange={(e) => {
              void add(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        <label className="file-label">
          <Camera size={16} /> Take a photo
          <input
            aria-label="Take a photo"
            type="file"
            accept="image/*"
            capture="environment"
            disabled={busy}
            onChange={(e) => {
              void add(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {busy && <p role="status">Saving…</p>}
      {errors.map((e) => (
        <p key={e} className="error" role="alert">
          {e}
        </p>
      ))}
      <p className="muted">
        Kept in your shared library. Photos over 1 MB are made smaller; a PDF can be up to 6 MB.
      </p>
    </section>
  )
}
