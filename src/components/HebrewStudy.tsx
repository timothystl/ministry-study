import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  explainGrammar,
  loadHebrewTables,
  lookupLexicon,
  plainHebrew,
  wordParts,
  type HebrewTables,
  type HebrewWord,
} from '../lib/hebrewWords'

// The words of a Hebrew verse, each one a button that opens the word study below the table.
export function HebrewVerse({
  words,
  keyPrefix,
  picked,
  onPick,
}: {
  words: HebrewWord[]
  keyPrefix: string
  picked: string
  onPick: (key: string, word: HebrewWord) => void
}) {
  return (
    <>
      {words.map((word, i) => {
        const key = `${keyPrefix}#${i}`
        return (
          <button
            type="button"
            key={key}
            className={`bible-word ${picked === key ? 'picked' : ''}`}
            aria-pressed={picked === key}
            onClick={() => onPick(key, word)}
          >
            {plainHebrew(word)}
          </button>
        )
      })}
    </>
  )
}

const roleLabel = { root: 'Word', prefix: 'Prefix', suffix: 'Ending' } as const

export function WordStudy({
  word,
  reference,
  onClose,
}: {
  word: HebrewWord
  reference: string
  onClose: () => void
}) {
  const [tables, setTables] = useState<HebrewTables | null>(null)
  const [failed, setFailed] = useState('')
  useEffect(() => {
    let live = true
    loadHebrewTables().then(
      (t) => live && setTables(t),
      (e: Error) => live && setFailed(e.message),
    )
    return () => {
      live = false
    }
  }, [])
  const parts = wordParts(word)
  const language = word[4].charAt(0) === 'A' ? 'A' : 'H'
  return (
    <aside className="word-study" aria-label="Word study">
      <div className="word-study-head">
        <div>
          <p className="muted">{reference}</p>
          <p className="word-study-hebrew" lang="he" dir="rtl">
            {plainHebrew(word)}
          </p>
          <p>
            <em>{word[1].replace(/[/\\]/g, '')}</em> · {word[2].replace(/\s*\/\s*/g, ' ')}
          </p>
          {word[5] && (
            <p className="muted">
              {word[5] === 'Q'
                ? 'Qere: the scribes’ corrected reading, followed by translators.'
                : 'This word is added or restored in STEPBible’s text.'}
            </p>
          )}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Close word study"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      {failed && (
        <p className="error" role="alert">
          {failed}
        </p>
      )}
      <ul className="word-parts">
        {parts.map((part, i) => {
          const entry = tables ? lookupLexicon(tables, part.tag) : undefined
          const grammar =
            tables && part.grammar ? explainGrammar(tables, part.grammar, language) : ''
          return (
            <li key={i}>
              <div className="word-part-head">
                <span className="word-part-role">{roleLabel[part.role]}</span>
                <span className="word-part-hebrew" lang="he" dir="rtl">
                  {part.hebrew}
                </span>
                <span className="muted">
                  {part.translit} · {part.gloss}
                </span>
              </div>
              <dl>
                {entry && (
                  <>
                    <dt>Lexical form</dt>
                    <dd>
                      <span lang="he" dir="rtl">
                        {entry[0]}
                      </span>{' '}
                      ({entry[1]}): {entry[2]}
                    </dd>
                  </>
                )}
                <dt>Strong’s</dt>
                <dd>
                  {part.number}
                  {part.tag !== part.number && ` (${part.tag})`}
                </dd>
                {grammar && (
                  <>
                    <dt>Grammar</dt>
                    <dd>{grammar}</dd>
                  </>
                )}
              </dl>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
