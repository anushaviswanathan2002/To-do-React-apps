import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const LOAN_DAYS = 14
const MAX_LOANS = 5
const MAX_RENEWALS = 2
const FINE_CENTS_PER_DAY = 25
const DAY = 86400000

const ok = (v) => typeof v === 'string' && v.trim().length > 0
const httpError = (status, message) => Object.assign(new Error(message), { status })

export function createApp(db, { secret = process.env.JWT_SECRET, now = () => new Date() } = {}) {
  if (!secret) throw new Error('JWT_SECRET is required')
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(express.json({ limit: '100kb' }))

  const audit = (userId, action, detail) =>
    db.prepare('INSERT INTO audit_log (user_id, action, detail) VALUES (?,?,?)').run(userId, action, detail ?? null)
  const sign = (u) => jwt.sign({ sub: u.id, role: u.role }, secret, { expiresIn: '8h' })
  const publicUser = (u) => { const { password_hash, ...rest } = u; void password_hash; return rest }

  const auth = (req, _res, next) => {
    const h = req.headers.authorization || ''
    if (!h.startsWith('Bearer ')) return next(httpError(401, 'Authentication required'))
    try {
      const p = jwt.verify(h.slice(7), secret)
      const user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(p.sub)
      if (!user) throw new Error()
      req.user = user
      next()
    } catch {
      next(httpError(401, 'Invalid or expired token'))
    }
  }
  const staff = (req, _res, next) =>
    req.user.role === 'member' ? next(httpError(403, 'Staff access required')) : next()
  const admin = (req, _res, next) =>
    req.user.role !== 'admin' ? next(httpError(403, 'Admin access required')) : next()

  const api = express.Router()
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, skip: () => process.env.NODE_ENV === 'test' })

  api.post('/auth/register', authLimiter, (req, res) => {
    const { name, email, password } = req.body || {}
    if (!ok(name) || !ok(email) || !/^\S+@\S+\.\S+$/.test(email)) throw httpError(400, 'Valid name and email required')
    if (typeof password !== 'string' || password.length < 8) throw httpError(400, 'Password must be at least 8 characters')
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.toLowerCase())) throw httpError(409, 'Email already registered')
    const hash = bcrypt.hashSync(password, 10)
    const first = db.prepare('SELECT COUNT(*) c FROM users').get().c === 0
    const info = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)')
      .run(name.trim(), email.toLowerCase(), hash, first ? 'admin' : 'member')
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid)
    audit(user.id, 'register', email)
    res.status(201).json({ token: sign(user), user: publicUser(user) })
  })

  api.post('/auth/login', authLimiter, (req, res) => {
    const { email, password } = req.body || {}
    const user = ok(email) && typeof password === 'string'
      ? db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email.toLowerCase()) : null
    if (!user || !bcrypt.compareSync(password, user.password_hash)) throw httpError(401, 'Invalid credentials')
    audit(user.id, 'login')
    res.json({ token: sign(user), user: publicUser(user) })
  })

  api.use(auth)
  api.get('/auth/me', (req, res) => res.json({ user: publicUser(req.user) }))

  // ---- Books
  api.get('/books', (req, res) => {
    const q = `%${String(req.query.q || '').replace(/[%_]/g, '')}%`
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const size = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 10))
    const where = ['(title LIKE ? OR author LIKE ? OR isbn LIKE ?)']
    const args = [q, q, q]
    if (ok(req.query.category)) { where.push('category = ?'); args.push(req.query.category) }
    if (req.query.available === 'true') where.push('available_copies > 0')
    const w = where.join(' AND ')
    const total = db.prepare(`SELECT COUNT(*) c FROM books WHERE ${w}`).get(...args).c
    const items = db.prepare(`SELECT * FROM books WHERE ${w} ORDER BY title LIMIT ? OFFSET ?`).all(...args, size, (page - 1) * size)
    res.json({ items, total, page, pageSize: size })
  })
  api.get('/categories', (_req, res) =>
    res.json(db.prepare('SELECT DISTINCT category FROM books ORDER BY category').all().map((r) => r.category)))

  const bookInput = (b = {}) => {
    const copies = Number(b.totalCopies ?? 1)
    if (!ok(b.title) || !ok(b.author) || !ok(b.isbn)) throw httpError(400, 'Title, author and ISBN required')
    if (!Number.isInteger(copies) || copies < 0 || copies > 1000) throw httpError(400, 'Invalid copy count')
    return { isbn: b.isbn.trim(), title: b.title.trim(), author: b.author.trim(), category: ok(b.category) ? b.category.trim() : 'General', copies }
  }
  api.post('/books', staff, (req, res) => {
    const b = bookInput(req.body)
    if (db.prepare('SELECT 1 FROM books WHERE isbn = ?').get(b.isbn)) throw httpError(409, 'ISBN already exists')
    const info = db.prepare('INSERT INTO books (isbn,title,author,category,total_copies,available_copies) VALUES (?,?,?,?,?,?)')
      .run(b.isbn, b.title, b.author, b.category, b.copies, b.copies)
    audit(req.user.id, 'book.create', b.isbn)
    res.status(201).json(db.prepare('SELECT * FROM books WHERE id = ?').get(info.lastInsertRowid))
  })
  api.put('/books/:id', staff, (req, res) => {
    const cur = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id)
    if (!cur) throw httpError(404, 'Book not found')
    const b = bookInput(req.body)
    const out = cur.total_copies - cur.available_copies
    if (b.copies < out) throw httpError(400, `Cannot reduce below ${out} copies currently on loan`)
    if (db.prepare('SELECT 1 FROM books WHERE isbn = ? AND id != ?').get(b.isbn, cur.id)) throw httpError(409, 'ISBN already exists')
    db.prepare('UPDATE books SET isbn=?,title=?,author=?,category=?,total_copies=?,available_copies=? WHERE id=?')
      .run(b.isbn, b.title, b.author, b.category, b.copies, b.copies - out, cur.id)
    audit(req.user.id, 'book.update', String(cur.id))
    res.json(db.prepare('SELECT * FROM books WHERE id = ?').get(cur.id))
  })
  api.delete('/books/:id', admin, (req, res) => {
    const id = req.params.id
    if (!db.prepare('SELECT 1 FROM books WHERE id = ?').get(id)) throw httpError(404, 'Book not found')
    if (db.prepare('SELECT 1 FROM loans WHERE book_id = ? AND returned_at IS NULL').get(id)) throw httpError(409, 'Book has active loans')
    db.transaction(() => {
      db.prepare('DELETE FROM reservations WHERE book_id = ?').run(id)
      db.prepare('DELETE FROM loans WHERE book_id = ?').run(id)
      db.prepare('DELETE FROM books WHERE id = ?').run(id)
    })()
    audit(req.user.id, 'book.delete', String(id))
    res.status(204).end()
  })

  // ---- Loans
  const loanSelect = `SELECT l.*, b.title, b.author, u.name AS user_name FROM loans l
    JOIN books b ON b.id = l.book_id JOIN users u ON u.id = l.user_id`
  const fineFor = (loan) => {
    const end = loan.returned_at ? new Date(loan.returned_at) : now()
    const late = Math.floor((end - new Date(loan.due_at)) / DAY)
    return late > 0 ? late * FINE_CENTS_PER_DAY : 0
  }
  const withFine = (l) => ({ ...l, fine_cents: l.returned_at ? l.fine_cents : fineFor(l), overdue: !l.returned_at && new Date(l.due_at) < now() })

  api.get('/loans', (req, res) => {
    const isStaff = req.user.role !== 'member'
    const where = []
    const args = []
    if (!isStaff) { where.push('l.user_id = ?'); args.push(req.user.id) }
    else if (req.query.userId) { where.push('l.user_id = ?'); args.push(Number(req.query.userId)) }
    if (req.query.status === 'active') where.push('l.returned_at IS NULL')
    if (req.query.status === 'returned') where.push('l.returned_at IS NOT NULL')
    const rows = db.prepare(`${loanSelect} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY l.id DESC LIMIT 500`).all(...args).map(withFine)
    res.json(req.query.status === 'overdue' ? rows.filter((r) => r.overdue) : rows)
  })

  api.post('/loans', staff, (req, res) => {
    const { bookId, userId } = req.body || {}
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId)
    const member = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(userId)
    if (!book || !member) throw httpError(404, 'Book or member not found')
    if (db.prepare('SELECT COUNT(*) c FROM loans WHERE user_id = ? AND returned_at IS NULL').get(member.id).c >= MAX_LOANS)
      throw httpError(409, `Member has reached the limit of ${MAX_LOANS} loans`)
    if (db.prepare('SELECT 1 FROM loans WHERE user_id = ? AND book_id = ? AND returned_at IS NULL').get(member.id, book.id))
      throw httpError(409, 'Member already has this book')
    const unpaid = db.prepare('SELECT * FROM loans WHERE user_id = ? AND returned_at IS NOT NULL AND fine_cents > 0 AND fine_paid = 0').get(member.id)
    if (unpaid) throw httpError(409, 'Member has unpaid fines')
    const overdue = db.prepare('SELECT 1 FROM loans WHERE user_id = ? AND returned_at IS NULL AND due_at < ?').get(member.id, now().toISOString())
    if (overdue) throw httpError(409, 'Member has overdue loans')
    const queue = db.prepare("SELECT * FROM reservations WHERE book_id = ? AND status = 'waiting' ORDER BY id").all(book.id)
    const mine = queue.find((r) => r.user_id === member.id)
    if (book.available_copies < 1) throw httpError(409, 'No copies available')
    if (queue.filter((r) => r.user_id !== member.id).length >= book.available_copies && !mine)
      throw httpError(409, 'Copies are reserved for other members')
    const start = now()
    const due = new Date(start.getTime() + LOAN_DAYS * DAY)
    const id = db.transaction(() => {
      db.prepare('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?').run(book.id)
      if (mine) db.prepare("UPDATE reservations SET status='fulfilled' WHERE id = ?").run(mine.id)
      return db.prepare('INSERT INTO loans (book_id,user_id,borrowed_at,due_at) VALUES (?,?,?,?)')
        .run(book.id, member.id, start.toISOString(), due.toISOString()).lastInsertRowid
    })()
    audit(req.user.id, 'loan.checkout', `book ${book.id} user ${member.id}`)
    res.status(201).json(withFine(db.prepare(`${loanSelect} WHERE l.id = ?`).get(id)))
  })

  api.post('/loans/:id/return', staff, (req, res) => {
    const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id)
    if (!loan) throw httpError(404, 'Loan not found')
    if (loan.returned_at) throw httpError(409, 'Already returned')
    const returned = { ...loan, returned_at: now().toISOString() }
    const fine = fineFor(returned)
    db.transaction(() => {
      db.prepare('UPDATE loans SET returned_at = ?, fine_cents = ? WHERE id = ?').run(returned.returned_at, fine, loan.id)
      db.prepare('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?').run(loan.book_id)
    })()
    audit(req.user.id, 'loan.return', String(loan.id))
    res.json(withFine(db.prepare(`${loanSelect} WHERE l.id = ?`).get(loan.id)))
  })

  api.post('/loans/:id/renew', (req, res) => {
    const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id)
    if (!loan || (req.user.role === 'member' && loan.user_id !== req.user.id)) throw httpError(404, 'Loan not found')
    if (loan.returned_at) throw httpError(409, 'Already returned')
    if (new Date(loan.due_at) < now()) throw httpError(409, 'Overdue loans cannot be renewed')
    if (loan.renewals >= MAX_RENEWALS) throw httpError(409, 'Renewal limit reached')
    if (db.prepare("SELECT 1 FROM reservations WHERE book_id = ? AND status='waiting'").get(loan.book_id))
      throw httpError(409, 'Book is reserved by another member')
    const due = new Date(new Date(loan.due_at).getTime() + LOAN_DAYS * DAY).toISOString()
    db.prepare('UPDATE loans SET due_at = ?, renewals = renewals + 1 WHERE id = ?').run(due, loan.id)
    audit(req.user.id, 'loan.renew', String(loan.id))
    res.json(withFine(db.prepare(`${loanSelect} WHERE l.id = ?`).get(loan.id)))
  })

  api.post('/loans/:id/pay-fine', staff, (req, res) => {
    const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id)
    if (!loan) throw httpError(404, 'Loan not found')
    if (!loan.returned_at || loan.fine_cents <= 0) throw httpError(409, 'No fine to pay')
    db.prepare('UPDATE loans SET fine_paid = 1 WHERE id = ?').run(loan.id)
    audit(req.user.id, 'fine.paid', String(loan.id))
    res.json(withFine(db.prepare(`${loanSelect} WHERE l.id = ?`).get(loan.id)))
  })

  // ---- Reservations
  api.get('/reservations', (req, res) => {
    const member = req.user.role === 'member'
    res.json(db.prepare(`SELECT r.*, b.title, u.name AS user_name FROM reservations r
      JOIN books b ON b.id = r.book_id JOIN users u ON u.id = r.user_id
      WHERE r.status = 'waiting' ${member ? 'AND r.user_id = ?' : ''} ORDER BY r.id`).all(...(member ? [req.user.id] : [])))
  })
  api.post('/reservations', (req, res) => {
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.body?.bookId)
    if (!book) throw httpError(404, 'Book not found')
    if (book.available_copies > 0) throw httpError(409, 'Book is available; no need to reserve')
    if (db.prepare("SELECT 1 FROM reservations WHERE book_id=? AND user_id=? AND status='waiting'").get(book.id, req.user.id))
      throw httpError(409, 'Already reserved')
    if (db.prepare('SELECT 1 FROM loans WHERE book_id=? AND user_id=? AND returned_at IS NULL').get(book.id, req.user.id))
      throw httpError(409, 'You already have this book')
    const info = db.prepare('INSERT INTO reservations (book_id,user_id) VALUES (?,?)').run(book.id, req.user.id)
    res.status(201).json({ id: info.lastInsertRowid })
  })
  api.delete('/reservations/:id', (req, res) => {
    const r = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id)
    if (!r || (req.user.role === 'member' && r.user_id !== req.user.id)) throw httpError(404, 'Reservation not found')
    db.prepare("UPDATE reservations SET status='cancelled' WHERE id = ?").run(r.id)
    res.status(204).end()
  })

  // ---- Members (staff) & admin
  api.get('/members', staff, (_req, res) =>
    res.json(db.prepare('SELECT id,name,email,role,active,created_at FROM users ORDER BY name').all()))
  api.patch('/members/:id', admin, (req, res) => {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
    if (!u) throw httpError(404, 'Member not found')
    const { role, active } = req.body || {}
    if (role !== undefined && !['admin', 'librarian', 'member'].includes(role)) throw httpError(400, 'Invalid role')
    if (u.id === req.user.id && (role !== undefined && role !== 'admin' || active === false)) throw httpError(400, 'You cannot demote or deactivate yourself')
    db.prepare('UPDATE users SET role = ?, active = ? WHERE id = ?')
      .run(role ?? u.role, active === undefined ? u.active : active ? 1 : 0, u.id)
    audit(req.user.id, 'member.update', `${u.id} ${JSON.stringify({ role, active })}`)
    res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)))
  })
  api.get('/audit', admin, (_req, res) =>
    res.json(db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all()))

  api.get('/stats', staff, (_req, res) => {
    const one = (s, ...a) => db.prepare(s).get(...a).c
    res.json({
      titles: one('SELECT COUNT(*) c FROM books'),
      copies: one('SELECT COALESCE(SUM(total_copies),0) c FROM books'),
      members: one("SELECT COUNT(*) c FROM users WHERE role='member'"),
      activeLoans: one('SELECT COUNT(*) c FROM loans WHERE returned_at IS NULL'),
      overdueLoans: one('SELECT COUNT(*) c FROM loans WHERE returned_at IS NULL AND due_at < ?', now().toISOString()),
      reservations: one("SELECT COUNT(*) c FROM reservations WHERE status='waiting'"),
      unpaidFinesCents: one('SELECT COALESCE(SUM(fine_cents),0) c FROM loans WHERE returned_at IS NOT NULL AND fine_paid = 0'),
    })
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
