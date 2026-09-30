import { useState } from 'react'
import { Camera, FileText, Paperclip, Trash2 } from 'lucide-react'
import {
  ACCEPTED_FILES,
  attachFiles,
  NORMAL_IMAGES,
  REFERENCE_IMAGES,
  attachmentUrl,
  isImageAttachment,
  removeFile,
  sizeLabel,
  usedElsewhere,
  type Attachment,
} from '../lib/attachments'

// Photos and PDFs on a record. Picking files uploads them straight away and then saves the record
// with the new list; removing one takes it off the record and deletes the stored copy.
export function Attachments({
  attachments,
  onChange,
  heading = 'Photos and files',
  refs,
  compact = false,
  reference = false,
}: {
  attachments: Attachment[]
  onChange: (next: Attachment[]) => boolean
  heading?: string
  // How many records use each file, so a file another record also uses is not deleted.
  refs?: Map<string, number>
  compact?: boolean
  // Photos are kept small, for reference; the better image is linked instead of stored.
  reference?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [confirm, setConfirm] = useState('')
  async function add(list: FileList | null) {
    const files = [...(list || [])]
    if (!files.length) return
    setBusy(true)
    setErrors([])
    const { added, errors: problems } = await attachFiles(
      files,
      reference ? REFERENCE_IMAGES : NORMAL_IMAGES,
    )
    if (added.length && !onChange([...attachments, ...added])) {
      problems.push('The record could not be saved, so the files were not kept.')
      await Promise.all(added.map((a) => removeFile(a.id)))
    }
    setErrors(problems)
    setBusy(false)
  }
  function remove(a: Attachment) {
    if (onChange(attachments.filter((x) => x.id !== a.id)) && !(refs && usedElsewhere(refs, a.id)))
      void removeFile(a.id)
    setConfirm('')
  }
  return (
    <section className="detail-section" aria-label={heading}>
      {!compact && <h3>{heading}</h3>}
      {attachments.length === 0 && !compact && (
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
          <Paperclip size={16} /> Attach photos or files
          <input
            aria-label="Attach photos or files"
            type="file"
            multiple
            accept={ACCEPTED_FILES}
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
      {!compact && reference && (
        <p className="muted">
          Photos are made small (about 1 MB at most) because they are for reference. If a better
          image exists, link it under “Where it came from” instead of storing it.
        </p>
      )}
      {!compact && !reference && (
        <p className="muted">
          Kept in your shared library. Photos over 1.5 MB are made smaller. PDFs, music, slide and
          Finale files can be up to 8 MB.
        </p>
      )}
    </section>
  )
}
