import { useState, type ChangeEvent } from 'react'
import { readManuscript } from '../lib/sermonText'
import { briefForWriter, briefFromSermon, themeLabel, type SermonBrief } from '../lib/sermonBrief'
import { stripResponse, type Prayer, type PrayerSet } from '../lib/prayers'

// Read a sermon file and pull out what the sermon-tied prayer needs. The file is read on this
// device; only the short summary below is kept, and only if the prayer is saved.
export function SermonToPrayer({
  starters,
  draft,
  setDraft,
}: {
  starters: Prayer[]
  draft: PrayerSet
  setDraft: (s: PrayerSet) => void
}) {
  const [brief, setBrief] = useState<SermonBrief | null>(null),
    [error, setError] = useState(''),
    [note, setNote] = useState('')
  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setNote('')
    try {
      const { text } = await readManuscript(file)
      const found = briefFromSermon(text, file.name)
      setBrief(found)
      if (found.scripture && !draft.scripture) setDraft({ ...draft, scripture: found.scripture })
    } catch (err) {
      setBrief(null)
      setError(err instanceof Error ? err.message : 'That file could not be read.')
    }
  }
  const starterFor = (key: string) =>
    starters.find((s) => s.title.toLowerCase() === themeLabel(key).toLowerCase())
  async function copy() {
    if (!brief) return
    try {
      await navigator.clipboard.writeText(briefForWriter(brief))
      setNote('Copied. Paste it into the Prayer Writer.')
    } catch {
      setNote('Could not copy. Select the summary and copy it by hand.')
    }
  }
  return (
    <section className="sermon-to-prayer" aria-label="Start from a sermon file">
      <label className="wide-field">
        Start from your sermon (Word, text or Markdown)
        <input type="file" accept=".docx,.txt,.md,text/plain,text/markdown" onChange={pick} />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {brief && (
        <div className="sermon-brief">
          <dl>
            <dt>Sermon</dt>
            <dd>{brief.title || 'Untitled'}</dd>
            {brief.scripture && (
              <>
                <dt>Text</dt>
                <dd>{brief.scripture}</dd>
              </>
            )}
            {brief.themes.length > 0 && (
              <>
                <dt>Themes</dt>
                <dd>{brief.themes.map(themeLabel).join(', ')}</dd>
              </>
            )}
            {brief.gospel && (
              <>
                <dt>Where the gospel lands</dt>
                <dd>{brief.gospel}</dd>
              </>
            )}
            {brief.closing && (
              <>
                <dt>How it closes</dt>
                <dd>{brief.closing}</dd>
              </>
            )}
          </dl>
          <div className="sermon-actions">
            {brief.themes.map((key) => {
              const s = starterFor(key)
              return s ? (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDraft({ ...draft, petition: stripResponse(s.text) })}
                >
                  Start the prayer from {themeLabel(key)}
                </button>
              ) : null
            })}
            <button type="button" onClick={copy}>
              Copy for the Prayer Writer
            </button>
          </div>
          {note && (
            <p className="muted" role="status">
              {note}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
