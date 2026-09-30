import { useEffect, useState } from 'react'
import App from './App.tsx'
import { fetchMe, type MeResult } from './lib/me'
import { setStorageOwner } from './lib/storage'

// Finds out who is signed in before showing anything, so each person opens their own library.
export function Gate() {
  const [result, setResult] = useState<MeResult | null>(null)
  useEffect(() => {
    let cancelled = false
    void fetchMe().then((found) => {
      if (cancelled) return
      if (found.state === 'ok') setStorageOwner(found.me.role === 'admin' ? null : found.me.email)
      setResult(found)
    })
    return () => {
      cancelled = true
    }
  }, [])
  if (!result)
    return (
      <p className="gate" role="status">
        Opening the study…
      </p>
    )
  if (result.state === 'blocked')
    return (
      <main className="gate" id="main">
        <h1>{result.reason === 'paused' ? 'Access paused' : 'Not added yet'}</h1>
        <p>
          {result.email ? `You’re signed in as ${result.email}, but ` : 'You’re signed in, but '}
          {result.reason === 'paused'
            ? 'your access to the study has been paused.'
            : 'you haven’t been added to the study yet.'}{' '}
          Please contact Andrew.
        </p>
      </main>
    )
  return <App key={result.me.email} me={result.me} />
}
