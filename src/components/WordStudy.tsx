import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  explainGrammar,
  loadStudyTables,
  lookupLexicon,
  type StudyTables,
  type StudyWord,
} from '../lib/wordStudy'

// The words of a verse, each one a button that opens the word study below the table.
export function StudyVerse({
  words,
  keyPrefix,
  picked,
  onPick,
}: {
  words: StudyWord[]
  keyPrefix: string
  picked: string
  onPick: (key: string, word: StudyWord) => void
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
            {word.text}
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
  word: StudyWord
  reference: string
  onClose: () => void
}) {
  const [tables, setTables] = useState<StudyTables | null>(null)
  const [failed, setFailed] = useState('')
  useEffect(() => {
    let live = true
    loadStudyTables(word.language).then(
      (t) => live && setTables(t),
      (e: Error) => live && setFailed(e.message),
    )
    return () => {
      live = false
    }
  }, [word.language])
  const parts = word.parts
  // Aramaic passages carry an A in front of their grammar codes; Hebrew ones an H.
  const language = word.parts[0]?.grammar.charAt(0) === 'A' ? 'A' : 'H'
  return (
    <aside className="word-study" aria-label="Word study">
      <div className="word-study-head">
        <div>
          <p className="muted">{reference}</p>
          <p
            className="word-study-hebrew"
            lang={word.language === 'Hebrew' ? 'he' : 'el'}
            dir={word.language === 'Hebrew' ? 'rtl' : undefined}
          >
            {word.text}
          </p>
          <p>
            <em>{word.translit}</em> · {word.gloss}
          </p>
          {word.note && <p className="muted">{word.note}</p>}
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
                <span
                  className="word-part-hebrew"
                  lang={word.language === 'Hebrew' ? 'he' : 'el'}
                  dir={word.language === 'Hebrew' ? 'rtl' : undefined}
                >
                  {part.hebrew}
                </span>
                <span className="muted">
                  {part.translit} · {part.gloss}
                </span>
              </div>
              <dl>
                {part.lemma && (
                  <>
                    <dt>Dictionary form</dt>
                    <dd>
                      <span lang="el">{part.lemma}</span>
                      {part.lemmaGloss ? `: ${part.lemmaGloss}` : ''}
                    </dd>
                  </>
                )}
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
