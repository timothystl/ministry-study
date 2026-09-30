import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'
import { HebrewVerse, WordStudy } from './HebrewStudy'
import type { HebrewWord } from '../lib/hebrewWords'
import {
  ESV_COPYRIGHT,
  languages,
  versions,
  loadBibliaVersions,
  loadYvpVersions,
  NET_COPYRIGHT,
  YVP_NOTICE,
  defaultVersionIds,
  type Version,
  loadChapter,
  passagesFor,
  saveVersionIds,
  savedVersionIds,
  testamentOf,
  versionsFor,
  type Passage,
  type Testament,
  type Verse,
} from '../lib/bible'

type Failed = { error: string }
type Loaded = Record<string, Verse[] | Failed>
// Text with footnote markers ⟦1⟧ shows a small number that opens the note beneath the verse.
function VerseText({ text, notes }: { text: string; notes?: string[] }) {
  const [open, setOpen] = useState<number | null>(null)
  if (!notes) return <>{text}</>
  return (
    <>
      {text.split(/⟦(\d+)⟧/).map((part, i) =>
        i % 2 === 0 ? (
          part
        ) : (
          <sup key={i}>
            <button
              type="button"
              className="bible-fn"
              aria-expanded={open === Number(part)}
              aria-label={`Footnote ${part}`}
              onClick={() => setOpen(open === Number(part) ? null : Number(part))}
            >
              {part}
            </button>
          </sup>
        ),
      )}
      {open !== null && notes[open - 1] && (
        <span className="bible-fn-body" role="note">
          <b>{open}.</b> {notes[open - 1]}
        </span>
      )}
    </>
  )
}
const isFailed = (x: Verse[] | Failed | undefined): x is Failed => !!x && !Array.isArray(x)
const label = (p: Passage) => `${p.book} ${p.chapter}`

function PassageTable({
  passage,
  ids,
  all,
  reload,
  picked,
  onPick,
}: {
  passage: Passage
  ids: string[]
  all: Version[]
  reload: number
  picked: string
  onPick: (key: string, word: HebrewWord, reference: string) => void
}) {
  const shown = all.filter((v) => ids.includes(v.id))
  const [loaded, setLoaded] = useState<Loaded>({})
  useEffect(() => {
    let live = true
    for (const v of all.filter((x) => ids.includes(x.id)))
      loadChapter(v.id, passage.book, passage.chapter).then(
        (verses) => live && setLoaded((l) => ({ ...l, [v.id]: verses })),
        (e: Error) => live && setLoaded((l) => ({ ...l, [v.id]: { error: e.message } })),
      )
    return () => {
      live = false
    }
  }, [passage.book, passage.chapter, ids, all, reload])
  const numbers = new Set<number>()
  for (const verses of Object.values(loaded))
    if (Array.isArray(verses))
      for (const v of verses)
        if (v.verse >= passage.first && v.verse <= passage.last) numbers.add(v.verse)
  const rows = [...numbers].sort((a, b) => a - b)
  const waiting = shown.some((v) => loaded[v.id] === undefined)
  return (
    <section className="bible-passage">
      <h2>{label(passage)}</h2>
      {!waiting && !rows.length && !shown.some((v) => isFailed(loaded[v.id])) && (
        <p className="muted">
          None of the chosen versions has these verses. Try another version, or check the numbers.
        </p>
      )}
      <div className="bible-scroll">
        <table className="bible-table">
          <thead>
            <tr>
              <th scope="col" className="bible-num">
                <span className="sr-only">Verse</span>
              </th>
              {shown.map((v) => (
                <th scope="col" key={v.id} title={v.name}>
                  {v.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n}>
                <th scope="row" className="bible-num">
                  {n}
                </th>
                {shown.map((v) => {
                  const chapter = loaded[v.id]
                  const found = Array.isArray(chapter)
                    ? chapter.find((x) => x.verse === n)
                    : undefined
                  return (
                    <td
                      key={v.id}
                      lang={v.language === 'Hebrew' ? 'he' : v.language === 'Greek' ? 'el' : 'en'}
                      dir={v.rtl ? 'rtl' : undefined}
                      className={`bible-text ${v.language.toLowerCase()}`}
                    >
                      {found?.words ? (
                        <HebrewVerse
                          words={found.words}
                          keyPrefix={`${passage.book} ${passage.chapter}:${n}`}
                          picked={picked}
                          onPick={(key, word) =>
                            onPick(key, word, `${passage.book} ${passage.chapter}:${n}`)
                          }
                        />
                      ) : found?.text ? (
                        <VerseText text={found.text} notes={found.notes} />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            {waiting && (
              <tr>
                <td colSpan={shown.length + 1} className="muted">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {shown.some((v) => isFailed(loaded[v.id])) && (
        <p className="error" role="alert">
          {shown
            .filter((v) => isFailed(loaded[v.id]))
            .map((v) => `${v.short}: ${(loaded[v.id] as Failed).error}`)
            .join(' ')}
        </p>
      )}
    </section>
  )
}

export function BibleStudy() {
  const [input, setInput] = useState('John 3:16–21'),
    [asked, setAsked] = useState('John 3:16–21'),
    [reload, setReload] = useState(0),
    [picked, setPicked] = useState<{ key: string; word: HebrewWord; reference: string } | null>(
      null,
    )
  const { passages, error } = useMemo(() => passagesFor(asked), [asked])
  const testament: Testament = passages.length ? testamentOf(passages[0].book) : 'NT'
  const [chosen, setChosen] = useState<Record<Testament, string[]>>(() => ({
    OT: savedVersionIds('OT'),
    NT: savedVersionIds('NT'),
  }))
  const [extra, setExtra] = useState<Version[]>([])
  useEffect(() => {
    let live = true
    void Promise.all([loadYvpVersions(), loadBibliaVersions()]).then(
      (found) => live && setExtra(found.flat()),
    )
    return () => {
      live = false
    }
  }, [])
  const all = useMemo(() => [...versions, ...extra], [extra])
  // What was ticked, limited to versions actually on offer for this testament.
  const ids = useMemo(() => {
    const offered = versionsFor(testament, extra)
    const kept = chosen[testament].filter((id) => offered.some((v) => v.id === id))
    return kept.length ? kept : defaultVersionIds(testament)
  }, [chosen, testament, extra])
  function toggle(id: string) {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    if (!next.length) return
    saveVersionIds(testament, next)
    setChosen({ ...chosen, [testament]: next })
  }
  function submit(e: FormEvent) {
    e.preventDefault()
    setAsked(input)
    setPicked(null)
    setReload((n) => n + 1)
  }
  return (
    <section className="sermons bible-study">
      <div className="sermons-head">
        <div>
          <h1>Bible Study</h1>
          <p className="muted">
            Read a passage in the original languages beside English translations.
          </p>
        </div>
      </div>
      <form className="bible-search" onSubmit={submit}>
        <div className="search-bar">
          <Search size={20} />
          <input
            aria-label="Passage"
            placeholder="John 3:16–21, Psalm 23, Genesis 1:1–2:3…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <button type="submit">Read</button>
      </form>
      <fieldset className="bible-versions">
        <legend>Versions for the {testament === 'OT' ? 'Old' : 'New'} Testament</legend>
        {[...languages, 'YouVersion', 'Biblia'].map((group) => {
          const list = versionsFor(testament, extra).filter((v) =>
            group === 'YouVersion'
              ? v.id.startsWith('yvp:')
              : group === 'Biblia'
                ? v.id.startsWith('biblia:')
                : !v.id.includes(':') && v.language === group,
          )
          if (!list.length) return null
          const boxes = list.map((v) => (
            <label key={v.id} title={`${v.name} · ${v.license}`}>
              <input type="checkbox" checked={ids.includes(v.id)} onChange={() => toggle(v.id)} />
              {v.short}
            </label>
          ))
          // A long list (a large Logos library) folds away so the page stays easy to read.
          return list.length > 12 ? (
            <details
              key={group}
              className="bible-group"
              open={list.some((v) => ids.includes(v.id))}
            >
              <summary>
                <strong>{group}</strong> ({list.length} Bibles)
              </summary>
              <div className="bible-group">{boxes}</div>
            </details>
          ) : (
            <div key={group} className="bible-group">
              <strong>{group}</strong>
              {boxes}
            </div>
          )
        })}
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {passages.map((p) => (
        <PassageTable
          key={`${p.book}${p.chapter}${p.first}${p.last}|${ids.join(',')}|${reload}`}
          passage={p}
          ids={ids}
          all={all}
          picked={picked?.key ?? ''}
          onPick={(key, word, reference) => setPicked({ key, word, reference })}
          reload={reload}
        />
      ))}
      {picked && (
        <WordStudy
          word={picked.word}
          reference={picked.reference}
          onClose={() => setPicked(null)}
        />
      )}
      {[...new Set(all.filter((v) => ids.includes(v.id) && v.credit).map((v) => v.credit))].map(
        (c) => (
          <p key={c} className="muted bible-note">
            {c}
          </p>
        ),
      )}
      {ids.includes('esv') && <p className="muted bible-note">{ESV_COPYRIGHT}</p>}
      {ids.includes('net') && <p className="muted bible-note">{NET_COPYRIGHT}</p>}
      {ids.some((id) => id.startsWith('yvp:')) && <p className="muted bible-note">{YVP_NOTICE}</p>}
      <p className="muted bible-note">
        Texts come from getBible.net, except the ESV (Crossway), the NET Bible (bible.org) and
        YouVersion. Hebrew follows the Hebrew verse numbering, which differs from English in places
        (most Psalm titles are verse 1), so a verse can sit in a different row. The NIV, NRSV and
        other copyrighted translations are not included.
      </p>
    </section>
  )
}
