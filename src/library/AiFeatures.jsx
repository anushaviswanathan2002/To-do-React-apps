import { useEffect, useState } from 'react'
import { api } from './api.js'

function useCall() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const call = async (fn) => {
    setError('')
    setBusy(true)
    try { return await fn() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return { error, busy, call }
}
const Err = ({ msg }) => (msg ? <p role="alert" className="lib-error">{msg}</p> : null)

function BookList({ items, label }) {
  if (!items.length) return <p>No results.</p>
  return (
    <ul aria-label={label}>
      {items.map((b) => (
        <li key={b.id}>
          <strong>{b.title}</strong> by {b.author} <small>({b.available_copies} available)</small>
          {b.reason && <em> — {b.reason}</em>}
        </li>
      ))}
    </ul>
  )
}

export function AiDiscover() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [recs, setRecs] = useState([])
  const { error, busy, call } = useCall()
  useEffect(() => { api('/ai/recommendations').then((d) => setRecs(d.items)).catch(() => {}) }, [])
  const search = (e) => {
    e.preventDefault()
    if (q.trim()) call(async () => setResults((await api(`/ai/search?q=${encodeURIComponent(q)}`)).items))
  }
  return (
    <section aria-label="AI discovery">
      <h2>Smart search</h2>
      <form className="lib-row" onSubmit={search}>
        <input aria-label="Describe what you want to read" placeholder="e.g. a sci-fi about a desert planet" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" disabled={busy}>Search</button>
      </form>
      <Err msg={error} />
      {results && <BookList items={results} label="Smart search results" />}
      <h2>Recommended for you</h2>
      <BookList items={recs} label="Recommendations" />
    </section>
  )
}

export function AiAssistant() {
  const [msgs, setMsgs] = useState([{ from: 'bot', text: 'Hi! Ask me to find books, recommend something, or check your loans and fines.' }])
  const [text, setText] = useState('')
  const { error, busy, call } = useCall()
  const send = (e) => {
    e.preventDefault()
    const m = text.trim()
    if (!m) return
    setText('')
    setMsgs((x) => [...x, { from: 'me', text: m }])
    call(async () => {
      const d = await api('/ai/chat', { method: 'POST', body: { message: m } })
      setMsgs((x) => [...x, { from: 'bot', text: d.reply }])
    })
  }
  return (
    <section aria-label="AI assistant">
      <h2>Library assistant</h2>
      <div role="log" aria-live="polite" className="lib-card">
        {msgs.map((m, i) => <p key={i}><strong>{m.from === 'me' ? 'You' : 'Assistant'}:</strong> {m.text}</p>)}
      </div>
      <Err msg={error} />
      <form className="lib-row" onSubmit={send}>
        <input aria-label="Message the assistant" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
        <button type="submit" disabled={busy}>Send</button>
      </form>
    </section>
  )
}

export function AiInsights() {
  const [data, setData] = useState(null)
  const { error, call } = useCall()
  useEffect(() => {
    call(async () => {
      const [risk, acq, dup] = await Promise.all([api('/ai/overdue-risk'), api('/ai/acquisitions'), api('/ai/duplicates')])
      setData({ risk: risk.items, acq: acq.items, dup: dup.items })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <section aria-label="AI insights">
      <h2>AI insights</h2>
      <Err msg={error} />
      {data && (
        <>
          <h3>Overdue risk (active loans)</h3>
          <table><thead><tr><th>Book</th><th>Member</th><th>Due</th><th>Risk</th></tr></thead><tbody>
            {data.risk.slice(0, 10).map((l) => <tr key={l.id}><td>{l.title}</td><td>{l.user_name}</td><td>{l.due_at.slice(0, 10)}</td><td>{Math.round(l.risk * 100)}%</td></tr>)}
            {!data.risk.length && <tr><td colSpan="4">No active loans.</td></tr>}
          </tbody></table>
          <h3>Suggested acquisitions</h3>
          <ul aria-label="Acquisitions">
            {data.acq.map((a) => <li key={a.id}>{a.title}: buy {a.suggestedCopies} more ({a.recentLoans} recent loans, {a.waiting} waiting)</li>)}
            {!data.acq.length && <li>No demand pressure detected.</li>}
          </ul>
          <h3>Possible duplicate records</h3>
          <ul aria-label="Duplicates">
            {data.dup.map((d, i) => <li key={i}>"{d.a.title}" ({d.a.isbn}) ≈ "{d.b.title}" ({d.b.isbn}), {Math.round(d.similarity * 100)}% similar</li>)}
            {!data.dup.length && <li>None found.</li>}
          </ul>
        </>
      )}
    </section>
  )
}

// Staff helpers inside the book form: suggest category and generate a description.
export function AiBookHelper({ form, setForm }) {
  const [sugg, setSugg] = useState([])
  const { error, busy, call } = useCall()
  const categorize = () => call(async () => setSugg((await api('/ai/categorize', { method: 'POST', body: form })).suggestions))
  const describe = () => call(async () => {
    const d = await api('/ai/describe', { method: 'POST', body: form })
    setForm((f) => ({ ...f, description: d.description }))
  })
  return (
    <div className="lib-row">
      <button type="button" onClick={categorize} disabled={busy || !form.title}>Suggest category</button>
      <button type="button" onClick={describe} disabled={busy || !form.title || !form.author}>Generate description</button>
      {sugg.map((s) => (
        <button type="button" key={s.category} className="link" onClick={() => setForm((f) => ({ ...f, category: s.category }))}>
          {s.category} ({Math.round(s.confidence * 100)}%)
        </button>
      ))}
      <Err msg={error} />
    </div>
  )
}
