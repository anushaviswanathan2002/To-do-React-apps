// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { openDb } from '../db.js'
import { createApp } from '../app.js'

let clock, app, admin, member
const DAY = 86400000
const as = (t) => ({ Authorization: `Bearer ${t}` })
const reg = async (name, email) =>
  (await request(app).post('/api/auth/register').send({ name, email, password: 'password123' })).body
const mkBook = (isbn, copies = 1) =>
  request(app).post('/api/books').set(as(admin.token)).send({ isbn, title: 'T' + isbn, author: 'A', totalCopies: copies })

beforeEach(async () => {
  clock = new Date('2025-01-01T00:00:00Z')
  app = createApp(openDb(':memory:'), { secret: 'test', now: () => clock })
  admin = await reg('Admin', 'admin@x.com')
  member = await reg('Mem', 'mem@x.com')
})

describe('auth', () => {
  it('first user is admin, later are members', () => {
    expect(admin.user.role).toBe('admin')
    expect(member.user.role).toBe('member')
    expect(member.user.password_hash).toBeUndefined()
  })
  it('rejects bad input, duplicates, bad login, missing token', async () => {
    expect((await request(app).post('/api/auth/register').send({ name: 'a', email: 'bad', password: 'password123' })).status).toBe(400)
    expect((await request(app).post('/api/auth/register').send({ name: 'a', email: 'b@x.com', password: 'short' })).status).toBe(400)
    expect((await request(app).post('/api/auth/register').send({ name: 'a', email: 'mem@x.com', password: 'password123' })).status).toBe(409)
    expect((await request(app).post('/api/auth/login').send({ email: 'mem@x.com', password: 'nope' })).status).toBe(401)
    expect((await request(app).get('/api/books')).status).toBe(401)
    expect((await request(app).post('/api/auth/login').send({ email: 'mem@x.com', password: 'password123' })).status).toBe(200)
  })
})

describe('books', () => {
  it('enforces roles and supports CRUD + search', async () => {
    expect((await request(app).post('/api/books').set(as(member.token)).send({ isbn: '1', title: 't', author: 'a' })).status).toBe(403)
    const created = await mkBook('111', 2)
    expect(created.status).toBe(201)
    expect((await mkBook('111')).status).toBe(409)
    const list = await request(app).get('/api/books?q=T11').set(as(member.token))
    expect(list.body.total).toBe(1)
    const upd = await request(app).put(`/api/books/${created.body.id}`).set(as(admin.token))
      .send({ isbn: '111', title: 'New', author: 'A', totalCopies: 3 })
    expect(upd.body.available_copies).toBe(3)
    expect((await request(app).delete(`/api/books/${created.body.id}`).set(as(member.token))).status).toBe(403)
    expect((await request(app).delete(`/api/books/${created.body.id}`).set(as(admin.token))).status).toBe(204)
  })
  it('treats SQL wildcard / injection input safely', async () => {
    await mkBook('222')
    const r = await request(app).get("/api/books").query({ q: "' OR 1=1 --" }).set(as(member.token))
    expect(r.status).toBe(200)
    expect(r.body.total).toBe(0)
  })
})

describe('loans', () => {
  it('checks out, blocks when none left, returns, and fines late returns', async () => {
    const b = (await mkBook('333', 1)).body
    const loan = await request(app).post('/api/loans').set(as(admin.token)).send({ bookId: b.id, userId: member.user.id })
    expect(loan.status).toBe(201)
    expect((await request(app).post('/api/loans').set(as(admin.token)).send({ bookId: b.id, userId: member.user.id })).status).toBe(409)
    clock = new Date(clock.getTime() + 20 * DAY) // 6 days late
    const mine = await request(app).get('/api/loans?status=overdue').set(as(member.token))
    expect(mine.body).toHaveLength(1)
    const ret = await request(app).post(`/api/loans/${loan.body.id}/return`).set(as(admin.token))
    expect(ret.body.fine_cents).toBe(150)
    const again = await request(app).post('/api/loans').set(as(admin.token)).send({ bookId: b.id, userId: member.user.id })
    expect(again.body.error).toMatch(/unpaid fines/)
    expect((await request(app).post(`/api/loans/${loan.body.id}/pay-fine`).set(as(admin.token))).status).toBe(200)
    expect((await request(app).post('/api/loans').set(as(admin.token)).send({ bookId: b.id, userId: member.user.id })).status).toBe(201)
  })
  it('renews up to the limit and members only see own loans', async () => {
    const b = (await mkBook('444', 2)).body
    const loan = (await request(app).post('/api/loans').set(as(admin.token)).send({ bookId: b.id, userId: member.user.id })).body
    await request(app).post('/api/loans').set(as(admin.token)).send({ bookId: b.id, userId: admin.user.id })
    expect((await request(app).post(`/api/loans/${loan.id}/renew`).set(as(member.token))).status).toBe(200)
    expect((await request(app).post(`/api/loans/${loan.id}/renew`).set(as(member.token))).status).toBe(200)
    expect((await request(app).post(`/api/loans/${loan.id}/renew`).set(as(member.token))).status).toBe(409)
    const list = await request(app).get('/api/loans').set(as(member.token))
    expect(list.body).toHaveLength(1)
    expect((await request(app).post(`/api/loans/${loan.id}/return`).set(as(member.token))).status).toBe(403)
  })
  it('honours reservation queue', async () => {
    const b = (await mkBook('555', 1)).body
    const other = await reg('Other', 'o@x.com')
    const loan = (await request(app).post('/api/loans').set(as(admin.token)).send({ bookId: b.id, userId: admin.user.id })).body
    expect((await request(app).post('/api/reservations').set(as(member.token)).send({ bookId: b.id })).status).toBe(201)
    expect((await request(app).post('/api/reservations').set(as(member.token)).send({ bookId: b.id })).status).toBe(409)
    await request(app).post(`/api/loans/${loan.id}/return`).set(as(admin.token))
    const blocked = await request(app).post('/api/loans').set(as(admin.token)).send({ bookId: b.id, userId: other.user.id })
    expect(blocked.status).toBe(409)
    expect((await request(app).post('/api/loans').set(as(admin.token)).send({ bookId: b.id, userId: member.user.id })).status).toBe(201)
    expect((await request(app).get('/api/reservations').set(as(member.token))).body).toHaveLength(0)
  })
})

describe('admin', () => {
  it('manages members, stats and audit', async () => {
    expect((await request(app).get('/api/members').set(as(member.token))).status).toBe(403)
    const up = await request(app).patch(`/api/members/${member.user.id}`).set(as(admin.token)).send({ role: 'librarian' })
    expect(up.body.role).toBe('librarian')
    expect((await request(app).patch(`/api/members/${admin.user.id}`).set(as(admin.token)).send({ active: false })).status).toBe(400)
    await request(app).patch(`/api/members/${member.user.id}`).set(as(admin.token)).send({ active: false })
    expect((await request(app).get('/api/auth/me').set(as(member.token))).status).toBe(401)
    expect((await request(app).get('/api/stats').set(as(admin.token))).body.titles).toBe(0)
    expect((await request(app).get('/api/audit').set(as(admin.token))).body.length).toBeGreaterThan(0)
  })
})
