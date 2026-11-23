import { useCallback, useEffect, useState } from 'react'
import { AiAssistant, AiBookHelper, AiDiscover, AiInsights } from './AiFeatures.jsx'
import { api, setToken, hasToken, money } from './api.js'

function useAsync() {
  const [error, setError] = useState('')
  const run = useCallback(async (fn) => {
    setError('')
    try { return await fn() } catch (e) { setError(e.message) }
  }, [])
  return [error, run, setError]
}
const Err = ({ msg }) => (msg ? <p role="alert" className="lib-error">{msg}</p> : null)

function AuthForm({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [error, run] = useAsync()
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = (e) => {
    e.preventDefault()
    run(async () => {
      const d = await api(`/auth/${mode}`, { method: 'POST', body: f })
      setToken(d.token)
      onAuth(d.user)
    })
  }
  return (
    <form className="lib-card lib-auth" onSubmit={submit}>
      <h1>Library Management</h1>
      <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
      {mode === 'register' && <label>Name<input value={f.name} onChange={set('name')} required /></label>}
      <label>Email<input type="email" value={f.email} onChange={set('email')} required /></label>
      <label>Password<input type="password" value={f.password} onChange={set('password')} required minLength={8} /></label>
      <Err msg={error} />
      <button type="submit">{mode === 'login' ? 'Sign in' : 'Register'}</button>
      <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
      </button>
      <p className="hint">The first registered user becomes the administrator.</p>
    </form>
  )
}

function BookForm({ user, book, onSaved, onCancel }) {
  const [f, setF] = useState(book ? { isbn: book.isbn, title: book.title, author: book.author, category: book.category, description: book.description || '', totalCopies: book.total_copies }
    : { isbn: '', title: '', author: '', category: '', description: '', totalCopies: 1 })
  const [error, run] = useAsync()
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = (e) => {
    e.preventDefault()
    run(async () => {
      await api(book ? `/books/${book.id}` : '/books', { method: book ? 'PUT' : 'POST', body: { ...f, totalCopies: Number(f.totalCopies) } })
      onSaved()
    })
  }
  return (
    <form className="lib-card" onSubmit={submit} aria-label={book ? 'Edit book' : 'Add book'}>
      <h3>{book ? 'Edit book' : 'Add book'}</h3>
      <label>Title<input value={f.title} onChange={set('title')} required /></label>
      <label>Author<input value={f.author} onChange={set('author')} required /></label>
      <label>ISBN<input value={f.isbn} onChange={set('isbn')} required /></label>
      <label>Category<input value={f.category} onChange={set('category')} /></label>
      <label>Description<textarea value={f.description} onChange={set('description')} maxLength={2000} /></label>
      {user?.role !== 'member' && <AiBookHelper form={f} setForm={setF} />}
      <label>Copies<input type="number" min="0" value={f.totalCopies} onChange={set('totalCopies')} /></label>
      <Err msg={error} />
      <button type="submit">Save</button> <button type="button" className="link" onClick={onCancel}>Cancel</button>
    </form>
  )
}

function Catalog({ user }) {
  const staff = user.role !== 'member'
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, pageSize: 10 })
  const [members, setMembers] = useState([])
  const [editing, setEditing] = useState(null)
  const [error, run] = useAsync()
  const [notice, setNotice] = useState('')
  const load = useCallback(() => run(async () => setData(await api(`/books?q=${encodeURIComponent(q)}&page=${page}`))), [q, page, run])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (staff) run(async () => setMembers((await api('/members')).filter((m) => m.active))) }, [staff, run])

  const act = (fn, msg) => run(async () => { await fn(); setNotice(msg); load() })
  const checkout = (b, userId) => act(() => api('/loans', { method: 'POST', body: { bookId: b.id, userId: Number(userId) } }), `Checked out "${b.title}"`)
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize))

  return (
    <section aria-label="Catalog">
      <div className="lib-row">
        <input type="search" aria-label="Search books" placeholder="Search title, author, ISBN" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        {staff && <button onClick={() => setEditing({})}>Add book</button>}
      </div>
      <Err msg={error} />
      {notice && <p role="status">{notice}</p>}
      {editing && <BookForm user={user} book={editing.id ? editing : null} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      <table>
        <thead><tr><th>Title</th><th>Author</th><th>ISBN</th><th>Category</th><th>Available</th><th>Actions</th></tr></thead>
        <tbody>
          {data.items.map((b) => (
            <tr key={b.id}>
              <td>{b.title}</td><td>{b.author}</td><td>{b.isbn}</td><td>{b.category}</td>
              <td>{b.available_copies}/{b.total_copies}</td>
              <td>
                {b.available_copies === 0 && <button onClick={() => act(() => api('/reservations', { method: 'POST', body: { bookId: b.id } }), `Reserved "${b.title}"`)}>Reserve</button>}
                {staff && b.available_copies > 0 && (
                  <select aria-label={`Check out ${b.title} to`} value="" onChange={(e) => e.target.value && checkout(b, e.target.value)}>
                    <option value="">Check out to…</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}
                {staff && <button className="link" onClick={() => setEditing(b)}>Edit</button>}
                {user.role === 'admin' && <button className="link" onClick={() => window.confirm(`Delete "${b.title}"?`) && act(() => api(`/books/${b.id}`, { method: 'DELETE' }), 'Book deleted')}>Delete</button>}
              </td>
            </tr>
          ))}
          {data.items.length === 0 && <tr><td colSpan="6">No books found.</td></tr>}
        </tbody>
      </table>
      <div className="lib-row">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {pages}</span>
        <button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </section>
  )
}

function Loans({ user }) {
  const staff = user.role !== 'member'
  const [loans, setLoans] = useState([])
  const [res, setRes] = useState([])
  const [error, run] = useAsync()
  const load = useCallback(() => run(async () => {
    setLoans(await api('/loans'))
    setRes(await api('/reservations'))
  }), [run])
  useEffect(() => { load() }, [load])
  const act = (path, method = 'POST') => run(async () => { await api(path, { method }); load() })
  return (
    <section aria-label="Loans">
      <Err msg={error} />
      <h2>Loans</h2>
      <table>
        <thead><tr><th>Book</th>{staff && <th>Member</th>}<th>Due</th><th>Status</th><th>Fine</th><th>Actions</th></tr></thead>
        <tbody>
          {loans.map((l) => (
            <tr key={l.id} className={l.overdue ? 'overdue' : ''}>
              <td>{l.title}</td>{staff && <td>{l.user_name}</td>}
              <td>{l.due_at.slice(0, 10)}</td>
              <td>{l.returned_at ? 'Returned' : l.overdue ? 'Overdue' : 'Active'}</td>
              <td>{l.fine_cents ? `${money(l.fine_cents)}${l.fine_paid ? ' (paid)' : ''}` : '—'}</td>
              <td>
                {!l.returned_at && <button onClick={() => act(`/loans/${l.id}/renew`)}>Renew</button>}
                {staff && !l.returned_at && <button onClick={() => act(`/loans/${l.id}/return`)}>Return</button>}
                {staff && l.returned_at && l.fine_cents > 0 && !l.fine_paid && <button onClick={() => act(`/loans/${l.id}/pay-fine`)}>Mark fine paid</button>}
              </td>
            </tr>
          ))}
          {loans.length === 0 && <tr><td colSpan="6">No loans.</td></tr>}
        </tbody>
      </table>
      <h2>Reservations</h2>
      <ul>
        {res.map((r) => <li key={r.id}>{r.title}{staff ? ` — ${r.user_name}` : ''} <button className="link" onClick={() => act(`/reservations/${r.id}`, 'DELETE')}>Cancel</button></li>)}
        {res.length === 0 && <li>No reservations.</li>}
      </ul>
    </section>
  )
}

function Admin({ user }) {
  const [stats, setStats] = useState(null)
  const [members, setMembers] = useState([])
  const [audit, setAudit] = useState([])
  const [error, run] = useAsync()
  const isAdmin = user.role === 'admin'
  const load = useCallback(() => run(async () => {
    setStats(await api('/stats'))
    setMembers(await api('/members'))
    if (isAdmin) setAudit(await api('/audit'))
  }), [run, isAdmin])
  useEffect(() => { load() }, [load])
  const patch = (id, body) => run(async () => { await api(`/members/${id}`, { method: 'PATCH', body }); load() })
  return (
    <section aria-label="Dashboard">
      <Err msg={error} />
      {stats && (
        <dl className="lib-stats">
          <div><dt>Titles</dt><dd>{stats.titles}</dd></div>
          <div><dt>Copies</dt><dd>{stats.copies}</dd></div>
          <div><dt>Members</dt><dd>{stats.members}</dd></div>
          <div><dt>Active loans</dt><dd>{stats.activeLoans}</dd></div>
          <div><dt>Overdue</dt><dd>{stats.overdueLoans}</dd></div>
          <div><dt>Reservations</dt><dd>{stats.reservations}</dd></div>
          <div><dt>Unpaid fines</dt><dd>{money(stats.unpaidFinesCents)}</dd></div>
        </dl>
      )}
      <h2>Members</h2>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td>{m.name}</td><td>{m.email}</td>
              <td>{isAdmin ? (
                <select aria-label={`Role for ${m.name}`} value={m.role} onChange={(e) => patch(m.id, { role: e.target.value })}>
                  <option>member</option><option>librarian</option><option>admin</option>
                </select>) : m.role}</td>
              <td>{m.active ? 'Active' : 'Disabled'} {isAdmin && <button className="link" onClick={() => patch(m.id, { active: !m.active })}>{m.active ? 'Disable' : 'Enable'}</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {isAdmin && (<><h2>Audit log</h2>
        <ul>{audit.slice(0, 20).map((a) => <li key={a.id}>{a.created_at} — {a.action} {a.detail}</li>)}</ul></>)}
    </section>
  )
}

export default function LibraryApp() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(!hasToken())
  const [tab, setTab] = useState('catalog')
  useEffect(() => {
    if (!hasToken()) return
    api('/auth/me').then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setReady(true))
  }, [])
  if (!ready) return <p>Loading…</p>
  if (!user) return <main className="lib"><AuthForm onAuth={setUser} /></main>
  const tabs = [['catalog', 'Catalog'], ['discover', 'Discover (AI)'], ['assistant', 'Assistant (AI)'], ['loans', user.role === 'member' ? 'My loans' : 'Loans'], ...(user.role !== 'member' ? [['admin', 'Dashboard'], ['insights', 'AI insights']] : [])]
  return (
    <main className="lib">
      <header className="lib-row">
        <h1>Library</h1>
        <nav aria-label="Main">{tabs.map(([k, label]) => <button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>{label}</button>)}</nav>
        <span>{user.name} ({user.role})</span>
        <button onClick={() => { setToken(null); setUser(null) }}>Sign out</button>
      </header>
      {tab === 'catalog' && <Catalog user={user} />}
      {tab === 'loans' && <Loans user={user} />}
      {tab === 'discover' && <AiDiscover />}
      {tab === 'assistant' && <AiAssistant />}
      {tab === 'insights' && <AiInsights />}
      {tab === 'admin' && <Admin user={user} />}
    </main>
  )
}
