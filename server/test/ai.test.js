// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { openDb } from '../db.js'
import { createApp } from '../app.js'
import * as ai from '../ai.js'

const as = (t) => ({ Authorization: `Bearer ${t}` })
let app, admin, member, clock, llmCalls

const reg = async (name, email) =>
  (await request(app).post('/api/auth/register').send({ name, email, password: 'password123' })).body
const mk = async (isbn, title, author, category, description = '', copies = 1) =>
  (await request(app).post('/api/books').set(as(admin.token)).send({ isbn, title, author, category, description, totalCopies: copies })).body

beforeEach(async () => {
  clock = new Date('2025-01-01T00:00:00Z')
  llmCalls = []
  app = createApp(openDb(':memory:'), { secret: 't', now: () => clock, llmImpl: null })
  admin = await reg('Admin', 'a@x.com')
  member = await reg('Mem', 'm@x.com')
})

describe('ai library functions', () => {
  const books = [
    { id: 1, title: 'Dune', author: 'Frank Herbert', category: 'Science Fiction', description: 'desert planet spice empire' },
    { id: 2, title: 'Learning Python', author: 'Mark Lutz', category: 'Technology', description: 'programming language software' },
    { id: 3, title: 'Cooking Basics', author: 'Jo Chef', category: 'Cooking', description: 'recipes for the kitchen' },
  ]
  it('semantic search ranks by meaning-ish overlap and handles synonyms', () => {
    expect(ai.semanticSearch(books, 'coding in python')[0].id).toBe(2)
    expect(ai.semanticSearch(books, 'sci-fi about a planet')[0].id).toBe(1)
    expect(ai.semanticSearch(books, 'zzzz')).toEqual([])
  })
  it('categorizes by keywords', () => {
    expect(ai.categorize({ title: 'A dragon and a wizard quest' }).suggestions[0].category).toBe('Fantasy')
  })
  it('detects duplicate titles', () => {
    const d = ai.findDuplicates([...books, { id: 4, title: 'Dune!', author: 'F. Herbert', category: 'x' }, { id: 5, title: 'Dune', author: 'Frank Herbert', category: 'x' }])
    expect(d.some((x) => x.a.id === 1 && x.b.id === 5)).toBe(true)
    expect(d.some((x) => x.a.id === 2 || x.b.id === 3)).toBe(false)
  })
  it('detects intents', () => {
    expect(ai.detectIntent('how much are my fines?')).toBe('fines')
    expect(ai.detectIntent('recommend something')).toBe('recommend')
    expect(ai.detectIntent('books about python')).toBe('search')
  })
  it('callLLM returns null without key and parses a response with one', async () => {
    expect(await ai.callLLM([], { env: {} })).toBeNull()
    const f = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: ' hi ' } }] }) })
    expect(await ai.callLLM([], { env: { AI_API_KEY: 'k' }, fetchImpl: f })).toBe('hi')
    expect(await ai.callLLM([], { env: { AI_API_KEY: 'k' }, fetchImpl: async () => { throw new Error('x') } })).toBeNull()
  })
})

describe('ai endpoints', () => {
  it('requires auth and enforces staff-only endpoints', async () => {
    expect((await request(app).get('/api/ai/search?q=x')).status).toBe(401)
    for (const p of ['/api/ai/duplicates', '/api/ai/overdue-risk', '/api/ai/acquisitions'])
      expect((await request(app).get(p).set(as(member.token))).status).toBe(403)
    expect((await request(app).post('/api/ai/describe').set(as(member.token)).send({ title: 'a', author: 'b' })).status).toBe(403)
  })

  it('search, similar, recommendations', async () => {
    const dune = await mk('1', 'Dune', 'Herbert', 'Science Fiction', 'desert planet spice')
    await mk('2', 'Foundation', 'Asimov', 'Science Fiction', 'galactic empire planet')
    await mk('3', 'Baking Bread', 'Chef', 'Cooking', 'flour oven')
    const s = await request(app).get('/api/ai/search?q=planet%20science%20fiction').set(as(member.token))
    expect(s.body.items.map((b) => b.title)).toEqual(expect.arrayContaining(['Dune', 'Foundation']))
    expect(s.body.items.some((b) => b.title === 'Baking Bread')).toBe(false)
    const sim = await request(app).get(`/api/ai/similar/${dune.id}`).set(as(member.token))
    expect(sim.body.items[0].title).toBe('Foundation')
    expect((await request(app).get('/api/ai/similar/999').set(as(member.token))).status).toBe(404)
    await request(app).post('/api/loans').set(as(admin.token)).send({ bookId: dune.id, userId: member.user.id })
    const rec = await request(app).get('/api/ai/recommendations').set(as(member.token))
    expect(rec.body.items[0].title).toBe('Foundation')
    expect(rec.body.items.some((b) => b.title === 'Dune')).toBe(false)
  })

  it('categorize and describe (local fallback and LLM)', async () => {
    const c = await request(app).post('/api/ai/categorize').set(as(admin.token)).send({ title: 'Python programming and algorithms' })
    expect(c.body.suggestions[0].category).toBe('Technology')
    const d = await request(app).post('/api/ai/describe').set(as(admin.token)).send({ title: 'T', author: 'A' })
    expect(d.body.source).toBe('local')
    const app2 = createApp(openDb(':memory:'), { secret: 't', llmImpl: async (m) => { llmCalls.push(m); return 'LLM blurb' } })
    const a2 = (await request(app2).post('/api/auth/register').send({ name: 'A', email: 'z@x.com', password: 'password123' })).body
    const d2 = await request(app2).post('/api/ai/describe').set(as(a2.token)).send({ title: 'T', author: 'A' })
    expect(d2.body).toEqual({ description: 'LLM blurb', source: 'llm' })
  })

  it('overdue risk, duplicates and acquisitions', async () => {
    const b = await mk('1', 'Hot Book', 'Auth', 'General', '', 1)
    await mk('2', 'Hot Book.', 'Auth', 'General', '', 1)
    await request(app).post('/api/loans').set(as(admin.token)).send({ bookId: b.id, userId: member.user.id })
    clock = new Date('2025-01-20T00:00:00Z')
    const risk = await request(app).get('/api/ai/overdue-risk').set(as(admin.token))
    expect(risk.body.items[0].risk).toBeGreaterThan(0.6)
    expect((await request(app).get('/api/ai/duplicates').set(as(admin.token))).body.items).toHaveLength(1)
    await request(app).post('/api/reservations').set(as(admin.token)).send({ bookId: b.id })
    const acq = await request(app).get('/api/ai/acquisitions').set(as(admin.token))
    expect(acq.body.items[0].title).toBe('Hot Book')
  })

  it('chat answers from user-scoped data', async () => {
    const b = await mk('1', 'Dune', 'Herbert', 'Science Fiction', 'desert planet')
    await request(app).post('/api/loans').set(as(admin.token)).send({ bookId: b.id, userId: member.user.id })
    const say = async (message, t = member.token) => (await request(app).post('/api/ai/chat').set(as(t)).send({ message })).body
    expect((await say('what are my loans?')).reply).toContain('Dune')
    expect((await say('what are my loans?', admin.token)).reply).toContain('no active loans')
    clock = new Date('2025-01-20T00:00:00Z')
    expect((await say('how much are my fines?')).reply).toContain('1.25')
    expect((await say('books about a desert planet')).books[0].title).toBe('Dune')
    expect((await request(app).post('/api/ai/chat').set(as(member.token)).send({})).status).toBe(400)
  })
})
