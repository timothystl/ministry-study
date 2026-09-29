import { useEffect, useState } from 'react'
import { SECTIONS, type SectionKey } from '../lib/me'

interface Person {
  email: string
  name: string
  sections: SectionKey[]
  active: boolean
}
async function call(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  })
  const body = (await response.json().catch(() => ({}))) as { error?: string; people?: Person[] }
  if (!response.ok) throw new Error(body.error || 'That did not work. Nothing was changed.')
  return body.people ?? []
}
const put = (person: Person) =>
  call(`/api/people/${encodeURIComponent(person.email)}`, {
    method: 'PUT',
    body: JSON.stringify({ name: person.name, sections: person.sections, active: person.active }),
  })

function Switches({
  sections,
  onChange,
  idPrefix,
}: {
  sections: SectionKey[]
  onChange: (next: SectionKey[]) => void
  idPrefix: string
}) {
  return (
    <fieldset className="people-parts">
      <legend>Parts of the study they can use</legend>
      {SECTIONS.map((s) => (
        <label key={s.key} htmlFor={`${idPrefix}-${s.key}`}>
          <input
            id={`${idPrefix}-${s.key}`}
            type="checkbox"
            checked={sections.includes(s.key)}
            onChange={(e) =>
              onChange(
                e.target.checked ? [...sections, s.key] : sections.filter((k) => k !== s.key),
              )
            }
          />
          <span>
            <strong>{s.label}</strong>
            <span className="muted"> {s.detail}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

export function People() {
  const [people, setPeople] = useState<Person[] | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false)
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [sections, setSections] = useState<SectionKey[]>([])
  useEffect(() => {
    let cancelled = false
    call('/api/people')
      .then((list) => !cancelled && setPeople(list))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [])
  async function change(person: Person, message: string) {
    setBusy(true)
    setError('')
    // Show the change at once; the list from the server replaces it, or restores it on a failure.
    setPeople((list) => list && list.map((p) => (p.email === person.email ? person : p)))
    try {
      setPeople(await put(person))
      setNotice(message)
    } catch (e) {
      setError((e as Error).message)
      setPeople(await call('/api/people').catch(() => null))
    } finally {
      setBusy(false)
    }
  }
  async function add(event: React.FormEvent) {
    event.preventDefault()
    const address = email.trim().toLowerCase()
    if (people?.some((p) => p.email === address)) {
      setError('That person has already been added. Change their parts below.')
      return
    }
    setBusy(true)
    setError('')
    try {
      setPeople(await put({ name: name.trim(), email: address, sections, active: true }))
      setNotice(
        `Added ${name.trim() || address}. Remember to let them sign in (see the note above).`,
      )
      setName('')
      setEmail('')
      setSections([])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="sermons people">
      <header className="sermons-head">
        <div>
          <h1>People</h1>
          <p className="muted">
            Each person you add gets a library of their own. You always have every part of the
            study; you don’t see their library and they don’t see yours.
          </p>
        </div>
      </header>
      <p className="muted">
        <strong>Two steps to let someone in:</strong> add them here, and also add their email to the
        Access policy for study.timothystl.org in Cloudflare (Zero Trust → Access → Applications).
        Until both are done they can’t sign in.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="sr-only" role="status">
        {notice}
      </div>
      {notice && <p className="muted">{notice}</p>}
      <form className="form-grid people-add" onSubmit={add} aria-label="Add a person">
        <h2 className="wide-field">Add a person</h2>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        <label>
          Email (the address they sign in with)
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
          />
        </label>
        <div className="wide-field">
          <Switches sections={sections} onChange={setSections} idPrefix="new" />
        </div>
        <div className="form-actions wide-field">
          <button className="primary" type="submit" disabled={busy}>
            Add person
          </button>
        </div>
      </form>
      <h2>Who has access</h2>
      {people === null && !error && <p className="muted">Loading…</p>}
      {people?.length === 0 && <p className="muted">No one has been added yet.</p>}
      <ul className="people-list">
        {people?.map((person) => (
          <li key={person.email} className={person.active ? '' : 'paused'}>
            <div className="people-who">
              <strong>{person.name}</strong>
              <span className="muted">{person.email}</span>
              {!person.active && <span className="sermon-reason">Access paused</span>}
            </div>
            <Switches
              idPrefix={person.email}
              sections={person.sections}
              onChange={(next) =>
                void change({ ...person, sections: next }, `Saved what ${person.name} can use.`)
              }
            />
            <div className="sermon-actions">
              <button
                disabled={busy}
                onClick={() =>
                  void change(
                    { ...person, active: !person.active },
                    person.active
                      ? `${person.name}’s access is paused. Their library is kept.`
                      : `${person.name} can sign in again.`,
                  )
                }
              >
                {person.active ? 'Pause access' : 'Restore access'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
