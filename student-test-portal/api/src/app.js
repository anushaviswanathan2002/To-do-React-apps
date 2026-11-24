import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { gradeAttempt, validateQuestion } from './grading.js'

const ok = (v) => typeof v === 'string' && v.trim().length > 0
const httpError = (status, message) => Object.assign(new Error(message), { status })
const GRACE_MS = 5000 // network latency allowance on submit

export function createApp(db, { secret = process.env.JWT_SECRET, now = () => new Date() } = {}) {
  if (!secret) throw new Error('JWT_SECRET is required')
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(express.json({ limit: '200kb' }))

  const audit = (uid, action, detail) =>
    db.prepare('INSERT INTO audit_log (user_id, action, detail) VALUES (?,?,?)').run(uid, action, detail ?? null)
  const sign = (u) => jwt.sign({ sub: u.id }, secret, { expiresIn: '8h' })
  const pub = (u) => { const { password_hash, ...r } = u; void password_hash; return r }
  const iso = () => now().toISOString()

  const auth = (req, _res, next) => {
    const h = req.headers.authorization || ''
    if (!h.startsWith('Bearer ')) return next(httpError(401, 'Authentication required'))
    try {
      const p = jwt.verify(h.slice(7), secret)
      const u = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(p.sub)
      if (!u) throw new Error()
      req.user = u
      next()
    } catch { next(httpError(401, 'Invalid or expired token')) }
  }
  const roles = (...allowed) => (req, _res, next) =>
    allowed.includes(req.user.role) ? next() : next(httpError(403, 'Insufficient permissions'))
  const teacher = roles('admin', 'teacher')
  const adminOnly = roles('admin')
  const student = roles('student')

  const api = express.Router()
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, skip: () => process.env.NODE_ENV === 'test' })

  api.post('/auth/register', limiter, (req, res) => {
    const { name, email, password } = req.body || {}
    if (!ok(name) || !ok(email) || !/^\S+@\S+\.\S+$/.test(email)) throw httpError(400, 'Valid name and email required')
    if (typeof password !== 'string' || password.length < 8) throw httpError(400, 'Password must be at least 8 characters')
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.toLowerCase())) throw httpError(409, 'Email already registered')
    const first = db.prepare('SELECT COUNT(*) c FROM users').get().c === 0
    const id = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)')
      .run(name.trim(), email.toLowerCase(), bcrypt.hashSync(password, 10), first ? 'admin' : 'student').lastInsertRowid
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    audit(u.id, 'register', u.email)
    res.status(201).json({ token: sign(u), user: pub(u) })
  })
  api.post('/auth/login', limiter, (req, res) => {
    const { email, password } = req.body || {}
    const u = ok(email) && typeof password === 'string'
      ? db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email.toLowerCase()) : null
    if (!u || !bcrypt.compareSync(password, u.password_hash)) throw httpError(401, 'Invalid credentials')
    audit(u.id, 'login')
    res.json({ token: sign(u), user: pub(u) })
  })

  api.use(auth)
  api.get('/auth/me', (req, res) => res.json({ user: pub(req.user) }))

  // ---------- Users (admin)
  api.get('/users', adminOnly, (_req, res) =>
    res.json(db.prepare('SELECT id,name,email,role,active,created_at FROM users ORDER BY name').all()))
  api.patch('/users/:id', adminOnly, (req, res) => {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
    if (!u) throw httpError(404, 'User not found')
    const { role, active } = req.body || {}
    if (role !== undefined && !['admin', 'teacher', 'student'].includes(role)) throw httpError(400, 'Invalid role')
    if (u.id === req.user.id && ((role !== undefined && role !== 'admin') || active === false))
      throw httpError(400, 'You cannot demote or deactivate yourself')
    db.prepare('UPDATE users SET role=?, active=? WHERE id=?')
      .run(role ?? u.role, active === undefined ? u.active : active ? 1 : 0, u.id)
    audit(req.user.id, 'user.update', `${u.id} ${JSON.stringify({ role, active })}`)
    res.json(pub(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)))
  })
  api.get('/audit', adminOnly, (_req, res) =>
    res.json(db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all()))

  // ---------- Tests
  const testRow = (t) => ({ ...t, shuffle: !!t.shuffle, published: !!t.published })
  const getTest = (id) => {
    const t = db.prepare('SELECT * FROM tests WHERE id = ?').get(id)
    if (!t) throw httpError(404, 'Test not found')
    return t
  }
  const ownsTest = (req, t) => req.user.role === 'admin' || t.created_by === req.user.id
  const testInput = (b = {}) => {
    if (!ok(b.title)) throw httpError(400, 'Title required')
    const dur = Number(b.durationMinutes), pass = Number(b.passPercent ?? 50), att = Number(b.maxAttempts ?? 1)
    if (!Number.isInteger(dur) || dur < 1 || dur > 600) throw httpError(400, 'Duration must be 1-600 minutes')
    if (!Number.isInteger(pass) || pass < 0 || pass > 100) throw httpError(400, 'Pass mark must be 0-100')
    if (!Number.isInteger(att) || att < 1 || att > 10) throw httpError(400, 'Attempts must be 1-10')
    const d = (v) => { if (!v) return null; const x = new Date(v); if (isNaN(x)) throw httpError(400, 'Invalid date'); return x.toISOString() }
    const opens = d(b.opensAt), closes = d(b.closesAt)
    if (opens && closes && closes <= opens) throw httpError(400, 'Close time must be after open time')
    return { title: b.title.trim(), description: typeof b.description === 'string' ? b.description.trim().slice(0, 2000) : '',
      subject: ok(b.subject) ? b.subject.trim() : 'General', dur, pass, att, shuffle: b.shuffle ? 1 : 0, opens, closes }
  }
  const windowOpen = (t) => (!t.opens_at || t.opens_at <= iso()) && (!t.closes_at || t.closes_at >= iso())

  api.get('/tests', (req, res) => {
    const isStudent = req.user.role === 'student'
    const rows = db.prepare(`SELECT t.*, u.name AS author,
        (SELECT COUNT(*) FROM questions q WHERE q.test_id = t.id) AS question_count,
        (SELECT COALESCE(SUM(points),0) FROM questions q WHERE q.test_id = t.id) AS total_points
      FROM tests t JOIN users u ON u.id = t.created_by
      ${isStudent ? 'WHERE t.published = 1' : req.user.role === 'teacher' ? 'WHERE t.created_by = ?' : ''}
      ORDER BY t.id DESC`).all(...(req.user.role === 'teacher' ? [req.user.id] : []))
    const mine = isStudent ? db.prepare('SELECT test_id, COUNT(*) n FROM attempts WHERE user_id = ? GROUP BY test_id').all(req.user.id) : []
    const used = new Map(mine.map((m) => [m.test_id, m.n]))
    res.json(rows.map((t) => ({ ...testRow(t), attempts_used: used.get(t.id) || 0, open_now: windowOpen(t) })))
  })

  api.post('/tests', teacher, (req, res) => {
    const i = testInput(req.body)
    const id = db.prepare(`INSERT INTO tests (title,description,subject,duration_minutes,pass_percent,max_attempts,shuffle,opens_at,closes_at,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(i.title, i.description, i.subject, i.dur, i.pass, i.att, i.shuffle, i.opens, i.closes, req.user.id).lastInsertRowid
    audit(req.user.id, 'test.create', String(id))
    res.status(201).json(testRow(getTest(id)))
  })

  api.get('/tests/:id', (req, res) => {
    const t = getTest(req.params.id)
    if (req.user.role === 'student') {
      if (!t.published) throw httpError(404, 'Test not found')
      return res.json({ ...testRow(t), open_now: windowOpen(t), question_count: db.prepare('SELECT COUNT(*) c FROM questions WHERE test_id=?').get(t.id).c })
    }
    if (!ownsTest(req, t)) throw httpError(403, 'Not your test')
    const qs = db.prepare('SELECT * FROM questions WHERE test_id = ? ORDER BY position, id').all(t.id)
      .map((q) => ({ ...q, options: JSON.parse(q.options), correct: JSON.parse(q.correct) }))
    res.json({ ...testRow(t), questions: qs })
  })

  api.put('/tests/:id', teacher, (req, res) => {
    const t = getTest(req.params.id)
    if (!ownsTest(req, t)) throw httpError(403, 'Not your test')
    const i = testInput(req.body)
    db.prepare(`UPDATE tests SET title=?,description=?,subject=?,duration_minutes=?,pass_percent=?,max_attempts=?,shuffle=?,opens_at=?,closes_at=? WHERE id=?`)
      .run(i.title, i.description, i.subject, i.dur, i.pass, i.att, i.shuffle, i.opens, i.closes, t.id)
    audit(req.user.id, 'test.update', String(t.id))
    res.json(testRow(getTest(t.id)))
  })

  api.post('/tests/:id/publish', teacher, (req, res) => {
    const t = getTest(req.params.id)
    if (!ownsTest(req, t)) throw httpError(403, 'Not your test')
    const publish = req.body?.published !== false
    if (publish && db.prepare('SELECT COUNT(*) c FROM questions WHERE test_id=?').get(t.id).c === 0)
      throw httpError(409, 'Add at least one question before publishing')
    db.prepare('UPDATE tests SET published=? WHERE id=?').run(publish ? 1 : 0, t.id)
    audit(req.user.id, publish ? 'test.publish' : 'test.unpublish', String(t.id))
    res.json(testRow(getTest(t.id)))
  })

  api.delete('/tests/:id', teacher, (req, res) => {
    const t = getTest(req.params.id)
    if (!ownsTest(req, t)) throw httpError(403, 'Not your test')
    if (db.prepare('SELECT 1 FROM attempts WHERE test_id=?').get(t.id)) throw httpError(409, 'Test has attempts; unpublish instead')
    db.prepare('DELETE FROM tests WHERE id=?').run(t.id)
    audit(req.user.id, 'test.delete', String(t.id))
    res.status(204).end()
  })

  // ---------- Questions
  const lockCheck = (t) => {
    if (db.prepare('SELECT 1 FROM attempts WHERE test_id=?').get(t.id)) throw httpError(409, 'Questions are locked once students have attempted the test')
  }
  const qInput = (b) => {
    const err = validateQuestion(b)
    if (err) throw httpError(400, err)
    return { type: b.type, text: b.text.trim(), options: JSON.stringify(b.type === 'truefalse' ? ['True', 'False'] : b.type === 'short' ? [] : b.options.map((o) => o.trim())),
      correct: JSON.stringify(b.type === 'short' ? b.correct.map((c) => c.trim()) : b.correct), points: b.points ?? 1 }
  }
  api.post('/tests/:id/questions', teacher, (req, res) => {
    const t = getTest(req.params.id)
    if (!ownsTest(req, t)) throw httpError(403, 'Not your test')
    lockCheck(t)
    const q = qInput(req.body)
    const pos = db.prepare('SELECT COALESCE(MAX(position),0)+1 p FROM questions WHERE test_id=?').get(t.id).p
    const id = db.prepare('INSERT INTO questions (test_id,type,text,options,correct,points,position) VALUES (?,?,?,?,?,?,?)')
      .run(t.id, q.type, q.text, q.options, q.correct, q.points, pos).lastInsertRowid
    res.status(201).json({ id })
  })
  api.put('/questions/:id', teacher, (req, res) => {
    const q = db.prepare('SELECT * FROM questions WHERE id=?').get(req.params.id)
    if (!q) throw httpError(404, 'Question not found')
    const t = getTest(q.test_id)
    if (!ownsTest(req, t)) throw httpError(403, 'Not your test')
    lockCheck(t)
    const n = qInput(req.body)
    db.prepare('UPDATE questions SET type=?,text=?,options=?,correct=?,points=? WHERE id=?').run(n.type, n.text, n.options, n.correct, n.points, q.id)
    res.json({ id: q.id })
  })
  api.delete('/questions/:id', teacher, (req, res) => {
    const q = db.prepare('SELECT * FROM questions WHERE id=?').get(req.params.id)
    if (!q) throw httpError(404, 'Question not found')
    const t = getTest(q.test_id)
    if (!ownsTest(req, t)) throw httpError(403, 'Not your test')
    lockCheck(t)
    db.prepare('DELETE FROM questions WHERE id=?').run(q.id)
    res.status(204).end()
  })

  // ---------- Attempts (students)
  const shuffled = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

  // Student-safe view: never includes correct answers.
  const attemptView = (a) => {
    const t = getTest(a.test_id)
    const order = JSON.parse(a.order_json)
    const rows = db.prepare('SELECT * FROM questions WHERE test_id=?').all(t.id)
    const byId = new Map(rows.map((q) => [q.id, q]))
    return {
      id: a.id, test: { id: t.id, title: t.title, duration_minutes: t.duration_minutes },
      started_at: a.started_at, deadline: a.deadline, server_time: iso(),
      answers: JSON.parse(a.answers),
      questions: order.map((id) => byId.get(id)).filter(Boolean)
        .map((q) => ({ id: q.id, type: q.type, text: q.text, options: JSON.parse(q.options), points: q.points })),
    }
  }
  const finalize = (a, at) => {
    const qs = db.prepare('SELECT * FROM questions WHERE test_id=?').all(a.test_id)
    const t = getTest(a.test_id)
    const { score, max } = gradeAttempt(qs, JSON.parse(a.answers))
    const passed = max > 0 && (score / max) * 100 >= t.pass_percent ? 1 : 0
    db.prepare('UPDATE attempts SET submitted_at=?, score=?, max_score=?, passed=? WHERE id=?').run(at, score, max, passed, a.id)
    return db.prepare('SELECT * FROM attempts WHERE id=?').get(a.id)
  }
  // Auto-submit attempts whose deadline has passed (lazy, on any access).
  const expire = (a) => {
    if (!a.submitted_at && a.deadline < iso()) return finalize(a, a.deadline)
    return a
  }
  const myAttempt = (req) => {
    const a = db.prepare('SELECT * FROM attempts WHERE id=?').get(req.params.id)
    if (!a || a.user_id !== req.user.id) throw httpError(404, 'Attempt not found')
    return expire(a)
  }

  api.post('/tests/:id/start', student, (req, res) => {
    const t = getTest(req.params.id)
    if (!t.published) throw httpError(404, 'Test not found')
    const open = db.prepare('SELECT * FROM attempts WHERE test_id=? AND user_id=? AND submitted_at IS NULL').get(t.id, req.user.id)
    if (open) {
      const cur = expire(open)
      if (!cur.submitted_at) return res.json(attemptView(cur))
    }
    if (!windowOpen(t)) throw httpError(403, 'This test is not currently open')
    const n = db.prepare('SELECT COUNT(*) c FROM attempts WHERE test_id=? AND user_id=?').get(t.id, req.user.id).c
    if (n >= t.max_attempts) throw httpError(409, 'No attempts remaining')
    const ids = db.prepare('SELECT id FROM questions WHERE test_id=? ORDER BY position,id').all(t.id).map((q) => q.id)
    if (!ids.length) throw httpError(409, 'Test has no questions')
    const start = now()
    let deadline = new Date(start.getTime() + t.duration_minutes * 60000)
    if (t.closes_at && new Date(t.closes_at) < deadline) deadline = new Date(t.closes_at)
    const id = db.prepare('INSERT INTO attempts (test_id,user_id,started_at,deadline,order_json) VALUES (?,?,?,?,?)')
      .run(t.id, req.user.id, start.toISOString(), deadline.toISOString(), JSON.stringify(t.shuffle ? shuffled(ids) : ids)).lastInsertRowid
    audit(req.user.id, 'attempt.start', `test ${t.id}`)
    res.status(201).json(attemptView(db.prepare('SELECT * FROM attempts WHERE id=?').get(id)))
  })

  api.get('/attempts/:id', student, (req, res) => {
    const a = myAttempt(req)
    if (a.submitted_at) throw httpError(409, 'Attempt already submitted')
    res.json(attemptView(a))
  })

  api.put('/attempts/:id/answers', student, (req, res) => {
    const a = myAttempt(req)
    if (a.submitted_at) throw httpError(409, 'Attempt already submitted')
    const incoming = req.body?.answers
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw httpError(400, 'answers object required')
    const valid = new Set(JSON.parse(a.order_json).map(String))
    const clean = {}
    for (const [k, v] of Object.entries(incoming)) {
      if (!valid.has(k)) continue
      if (typeof v === 'string') clean[k] = v.slice(0, 500)
      else if (typeof v === 'number' || (Array.isArray(v) && v.every((x) => Number.isInteger(x)))) clean[k] = v
    }
    db.prepare('UPDATE attempts SET answers=? WHERE id=?').run(JSON.stringify({ ...JSON.parse(a.answers), ...clean }), a.id)
    res.json({ saved: Object.keys(clean).length, server_time: iso() })
  })

  api.post('/attempts/:id/events', student, (req, res) => {
    const a = myAttempt(req)
    if (a.submitted_at) return res.status(204).end()
    const kind = String(req.body?.kind || '')
    if (!['tab_hidden', 'window_blur', 'copy_paste', 'fullscreen_exit'].includes(kind)) throw httpError(400, 'Invalid event')
    db.prepare('INSERT INTO proctor_events (attempt_id,kind,at) VALUES (?,?,?)').run(a.id, kind, iso())
    db.prepare('UPDATE attempts SET flags = flags + 1 WHERE id=?').run(a.id)
    res.status(204).end()
  })

  api.post('/attempts/:id/submit', student, (req, res) => {
    let a = db.prepare('SELECT * FROM attempts WHERE id=?').get(req.params.id)
    if (!a || a.user_id !== req.user.id) throw httpError(404, 'Attempt not found')
    if (a.submitted_at) throw httpError(409, 'Attempt already submitted')
    const late = now().getTime() > new Date(a.deadline).getTime() + GRACE_MS
    if (!late && req.body?.answers && typeof req.body.answers === 'object') {
      const valid = new Set(JSON.parse(a.order_json).map(String))
      const merged = { ...JSON.parse(a.answers) }
      for (const [k, v] of Object.entries(req.body.answers)) if (valid.has(k)) merged[k] = v
      db.prepare('UPDATE attempts SET answers=? WHERE id=?').run(JSON.stringify(merged), a.id)
      a = db.prepare('SELECT * FROM attempts WHERE id=?').get(a.id)
    }
    // Late submissions are graded on the answers autosaved before the deadline.
    const done = finalize(a, late ? a.deadline : iso())
    audit(req.user.id, 'attempt.submit', String(a.id))
    res.json(resultFor(done, req.user))
  })

  // ---------- Results
  const resultFor = (a, viewer) => {
    const t = getTest(a.test_id)
    const base = { id: a.id, test_id: t.id, test_title: t.title, user_id: a.user_id, submitted_at: a.submitted_at,
      score: a.score, max_score: a.max_score, percent: a.max_score ? Math.round((a.score / a.max_score) * 100) : 0,
      passed: !!a.passed, pass_percent: t.pass_percent, flags: a.flags }
    if (viewer.role !== 'student' || t.published) {
      const answers = JSON.parse(a.answers)
      base.review = JSON.parse(a.order_json).map((id) => db.prepare('SELECT * FROM questions WHERE id=?').get(id)).filter(Boolean).map((q) => ({
        id: q.id, type: q.type, text: q.text, options: JSON.parse(q.options), points: q.points,
        correct: JSON.parse(q.correct), answer: answers[q.id] ?? null,
        earned: gradeAttempt([q], answers).score,
      }))
    }
    return base
  }
  api.get('/results', (req, res) => {
    const student_ = req.user.role === 'student'
    const rows = db.prepare(`SELECT a.*, t.title AS test_title, u.name AS user_name FROM attempts a
      JOIN tests t ON t.id = a.test_id JOIN users u ON u.id = a.user_id
      WHERE a.submitted_at IS NOT NULL
      ${student_ ? 'AND a.user_id = ?' : req.user.role === 'teacher' ? 'AND t.created_by = ?' : ''}
      ${req.query.testId ? 'AND a.test_id = ?' : ''}
      ORDER BY a.id DESC LIMIT 500`).all(...(student_ || req.user.role === 'teacher' ? [req.user.id] : []), ...(req.query.testId ? [Number(req.query.testId)] : []))
    res.json(rows.map((a) => ({ id: a.id, test_id: a.test_id, test_title: a.test_title, user_name: a.user_name, submitted_at: a.submitted_at,
      score: a.score, max_score: a.max_score, percent: a.max_score ? Math.round((a.score / a.max_score) * 100) : 0, passed: !!a.passed, flags: a.flags })))
  })
  api.get('/results/:id', (req, res) => {
    const a = db.prepare('SELECT * FROM attempts WHERE id=?').get(req.params.id)
    if (!a) throw httpError(404, 'Result not found')
    const t = getTest(a.test_id)
    if (req.user.role === 'student' && a.user_id !== req.user.id) throw httpError(404, 'Result not found')
    if (req.user.role === 'teacher' && t.created_by !== req.user.id) throw httpError(403, 'Not your test')
    const cur = expire(a)
    if (!cur.submitted_at) throw httpError(409, 'Attempt in progress')
    res.json(resultFor(cur, req.user))
  })

  // ---------- Analytics
  api.get('/tests/:id/analytics', teacher, (req, res) => {
    const t = getTest(req.params.id)
    if (!ownsTest(req, t)) throw httpError(403, 'Not your test')
    const atts = db.prepare('SELECT * FROM attempts WHERE test_id=? AND submitted_at IS NOT NULL').all(t.id)
    const pcts = atts.map((a) => (a.max_score ? (a.score / a.max_score) * 100 : 0))
    const sorted = [...pcts].sort((x, y) => x - y)
    const avg = pcts.length ? pcts.reduce((s, v) => s + v, 0) / pcts.length : 0
    const median = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : 0
    const buckets = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i * 10 + 9 + (i === 9 ? 1 : 0), count: 0 }))
    pcts.forEach((p) => { buckets[Math.min(9, Math.floor(p / 10))].count++ })
    const qs = db.prepare('SELECT * FROM questions WHERE test_id=? ORDER BY position,id').all(t.id)
    const questions = qs.map((q) => {
      const correct = atts.filter((a) => gradeAttempt([q], JSON.parse(a.answers)).score > 0).length
      return { id: q.id, text: q.text, attempts: atts.length, correct, percentCorrect: atts.length ? Math.round((correct / atts.length) * 100) : 0 }
    })
    res.json({ attempts: atts.length, average: Math.round(avg * 10) / 10, median: Math.round(median * 10) / 10,
      passRate: atts.length ? Math.round((atts.filter((a) => a.passed).length / atts.length) * 100) : 0,
      flagged: atts.filter((a) => a.flags > 0).length, distribution: buckets, questions })
  })

  api.get('/tests/:id/export.csv', teacher, (req, res) => {
    const t = getTest(req.params.id)
    if (!ownsTest(req, t)) throw httpError(403, 'Not your test')
    const esc = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"` }
    const rows = db.prepare(`SELECT u.name,u.email,a.score,a.max_score,a.passed,a.flags,a.submitted_at FROM attempts a JOIN users u ON u.id=a.user_id
      WHERE a.test_id=? AND a.submitted_at IS NOT NULL ORDER BY u.name`).all(t.id)
    const csv = ['Name,Email,Score,Max,Passed,Flags,Submitted', ...rows.map((r) => [r.name, r.email, r.score, r.max_score, r.passed ? 'yes' : 'no', r.flags, r.submitted_at].map(esc).join(','))].join('\n')
    res.type('text/csv').send(csv)
  })

  api.get('/dashboard', (req, res) => {
    const c = (s, ...a) => db.prepare(s).get(...a).c
    if (req.user.role === 'student') {
      const done = db.prepare('SELECT * FROM attempts WHERE user_id=? AND submitted_at IS NOT NULL').all(req.user.id)
      return res.json({ available: c('SELECT COUNT(*) c FROM tests WHERE published=1'), completed: done.length, passed: done.filter((a) => a.passed).length,
        average: done.length ? Math.round(done.reduce((s, a) => s + (a.max_score ? (a.score / a.max_score) * 100 : 0), 0) / done.length) : 0 })
    }
    res.json({ tests: c('SELECT COUNT(*) c FROM tests'), published: c('SELECT COUNT(*) c FROM tests WHERE published=1'),
      students: c("SELECT COUNT(*) c FROM users WHERE role='student'"), submissions: c('SELECT COUNT(*) c FROM attempts WHERE submitted_at IS NOT NULL'),
      inProgress: c('SELECT COUNT(*) c FROM attempts WHERE submitted_at IS NULL AND deadline >= ?', iso()) })
  })

  app.use('/api', api)
  app.use('/api', (_req, _res, next) => next(httpError(404, 'Not found')))
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500)
    if (status === 500) console.error(err)
    res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message })
  })
  return app
}
