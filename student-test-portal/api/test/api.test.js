// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { openDb } from '../src/db.js'
import { createApp } from '../src/app.js'
import { gradeQuestion, validateQuestion } from '../src/grading.js'

let app, clock, admin, teacher, stu, stu2
const as = (t) => ({ Authorization: `Bearer ${t}` })
const reg = async (name, email) => (await request(app).post('/api/auth/register').send({ name, email, password: 'password123' })).body
const post = (p, t, b) => request(app).post(`/api${p}`).set(as(t)).send(b)

const QS = [
  { type: 'single', text: '2+2?', options: ['3', '4'], correct: [1], points: 2 },
  { type: 'multiple', text: 'Primes?', options: ['2', '3', '4'], correct: [0, 1], points: 2 },
  { type: 'truefalse', text: 'Sky is blue', correct: [0], points: 1 },
  { type: 'short', text: 'Capital of France', correct: ['Paris'], points: 1 },
]
async function makeTest(extra = {}) {
  const t = (await post('/tests', teacher.token, { title: 'Quiz', durationMinutes: 10, passPercent: 50, maxAttempts: 2, ...extra })).body
  for (const q of QS) await post(`/tests/${t.id}/questions`, teacher.token, q)
  await post(`/tests/${t.id}/publish`, teacher.token, {})
  return t
}

beforeEach(async () => {
  clock = new Date('2025-03-01T10:00:00Z')
  app = createApp(openDb(':memory:'), { secret: 's', now: () => clock })
  admin = await reg('Admin', 'a@x.com')
  teacher = await reg('Teach', 't@x.com')
  stu = await reg('Stu', 's@x.com')
  stu2 = await reg('Stu2', 's2@x.com')
  await request(app).patch(`/api/users/${teacher.user.id}`).set(as(admin.token)).send({ role: 'teacher' })
})

describe('grading', () => {
  it('grades each type', () => {
    const q = (type, correct, points = 2) => ({ type, correct: JSON.stringify(correct), points })
    expect(gradeQuestion(q('single', [1]), 1)).toBe(2)
    expect(gradeQuestion(q('single', [0]), 0)).toBe(2)
    expect(gradeQuestion(q('single', [1]), '')).toBe(0)
    expect(gradeQuestion(q('multiple', [0, 1]), [1, 0])).toBe(2)
    expect(gradeQuestion(q('multiple', [0, 1]), [0])).toBe(0)
    expect(gradeQuestion(q('short', ['Paris']), '  paris ')).toBe(2)
    expect(gradeQuestion(q('short', ['Paris']), undefined)).toBe(0)
  })
  it('validates questions', () => {
    expect(validateQuestion({ type: 'single', text: 'x', options: ['a', 'b'], correct: [2] })).toMatch(/range/)
    expect(validateQuestion({ type: 'single', text: 'x', options: ['a'], correct: [0] })).toMatch(/options/)
    expect(validateQuestion({ type: 'single', text: 'x', options: ['a', 'b'], correct: [0, 1] })).toMatch(/Exactly/)
    expect(validateQuestion({ type: 'short', text: 'x', correct: [] })).toMatch(/accepted/)
    expect(validateQuestion({ type: 'multiple', text: 'x', options: ['a', 'b'], correct: [0, 1] })).toBeNull()
  })
})

describe('auth & roles', () => {
  it('first user is admin; others students; guards enforced', async () => {
    expect(admin.user.role).toBe('admin')
    expect(stu.user.role).toBe('student')
    expect((await request(app).get('/api/tests')).status).toBe(401)
    expect((await post('/tests', stu.token, { title: 'x', durationMinutes: 5 })).status).toBe(403)
    expect((await request(app).get('/api/users').set(as(teacher.token))).status).toBe(403)
    expect((await request(app).post('/api/auth/login').send({ email: 's@x.com', password: 'bad' })).status).toBe(401)
    expect(JSON.stringify((await request(app).get('/api/auth/me').set(as(stu.token))).body)).not.toContain('password')
  })
})

describe('test authoring', () => {
  it('validates input, requires questions to publish, scopes teachers', async () => {
    expect((await post('/tests', teacher.token, { title: '', durationMinutes: 5 })).status).toBe(400)
    expect((await post('/tests', teacher.token, { title: 'a', durationMinutes: 0 })).status).toBe(400)
    expect((await post('/tests', teacher.token, { title: 'a', durationMinutes: 5, opensAt: '2025-01-02', closesAt: '2025-01-01' })).status).toBe(400)
    const t = (await post('/tests', teacher.token, { title: 'a', durationMinutes: 5 })).body
    expect((await post(`/tests/${t.id}/publish`, teacher.token, {})).status).toBe(409)
    expect((await post(`/tests/${t.id}/questions`, teacher.token, { type: 'single', text: 'q', options: ['a'], correct: [0] })).status).toBe(400)
    const other = await reg('T2', 't2@x.com')
    await request(app).patch(`/api/users/${other.user.id}`).set(as(admin.token)).send({ role: 'teacher' })
    expect((await request(app).get(`/api/tests/${t.id}`).set(as(other.token))).status).toBe(403)
    expect((await request(app).get(`/api/tests/${t.id}`).set(as(admin.token))).status).toBe(200)
  })
})

describe('taking a test', () => {
  it('never leaks answers, grades correctly, enforces attempts and results visibility', async () => {
    const t = await makeTest()
    const list = await request(app).get('/api/tests').set(as(stu.token))
    expect(list.body).toHaveLength(1)
    const start = await post(`/tests/${t.id}/start`, stu.token)
    expect(start.status).toBe(201)
    expect(JSON.stringify(start.body)).not.toContain('correct')
    expect((await request(app).get(`/api/tests/${t.id}`).set(as(stu.token))).body.questions).toBeUndefined()
    const a = start.body
    const [q1, q2, q3, q4] = a.questions
    // another student can't touch it
    expect((await request(app).put(`/api/attempts/${a.id}/answers`).set(as(stu2.token)).send({ answers: {} })).status).toBe(404)
    const save = await request(app).put(`/api/attempts/${a.id}/answers`).set(as(stu.token)).send({ answers: { [q1.id]: 1, [q2.id]: [0, 1], 9999: 1 } })
    expect(save.body.saved).toBe(2)
    // resuming returns same attempt with saved answers
    const resume = await post(`/tests/${t.id}/start`, stu.token)
    expect(resume.status).toBe(200)
    expect(resume.body.id).toBe(a.id)
    expect(resume.body.answers[q1.id]).toBe(1)
    const sub = await post(`/attempts/${a.id}/submit`, stu.token, { answers: { [q3.id]: 0, [q4.id]: 'paris' } })
    expect(sub.body.score).toBe(6)
    expect(sub.body.percent).toBe(100)
    expect(sub.body.passed).toBe(true)
    expect(sub.body.review[0].correct).toBeDefined()
    expect((await post(`/attempts/${a.id}/submit`, stu.token)).status).toBe(409)
    expect((await request(app).get(`/api/results/${a.id}`).set(as(stu2.token))).status).toBe(404)
    // second attempt allowed, third not
    const a2 = await post(`/tests/${t.id}/start`, stu.token)
    await post(`/attempts/${a2.body.id}/submit`, stu.token, {})
    const r2 = await request(app).get(`/api/results/${a2.body.id}`).set(as(stu.token))
    expect(r2.body.score).toBe(0)
    expect(r2.body.passed).toBe(false)
    expect((await post(`/tests/${t.id}/start`, stu.token)).body.error).toMatch(/attempts/)
  })

  it('auto-submits after the deadline and ignores late answers', async () => {
    const t = await makeTest({ maxAttempts: 1 })
    const a = (await post(`/tests/${t.id}/start`, stu.token)).body
    const q1 = a.questions[0]
    await request(app).put(`/api/attempts/${a.id}/answers`).set(as(stu.token)).send({ answers: { [q1.id]: 1 } })
    clock = new Date(clock.getTime() + 11 * 60000)
    const late = await request(app).put(`/api/attempts/${a.id}/answers`).set(as(stu.token)).send({ answers: { [q1.id]: 0 } })
    expect(late.status).toBe(409)
    const res = (await request(app).get(`/api/results/${a.id}`).set(as(stu.token))).body
    expect(res.score).toBe(2)
    expect((await post(`/tests/${t.id}/start`, stu.token)).status).toBe(409)
  })

  it('locks questions after attempts, respects open window and unpublished tests', async () => {
    const t = await makeTest({ opensAt: '2025-03-02T00:00:00Z' })
    expect((await post(`/tests/${t.id}/start`, stu.token)).status).toBe(403)
    clock = new Date('2025-03-02T01:00:00Z')
    const a = (await post(`/tests/${t.id}/start`, stu.token)).body
    expect((await post(`/tests/${t.id}/questions`, teacher.token, QS[0])).status).toBe(409)
    expect((await request(app).delete(`/api/tests/${t.id}`).set(as(teacher.token))).status).toBe(409)
    await post(`/tests/${t.id}/publish`, teacher.token, { published: false })
    expect((await post(`/tests/${t.id}/start`, stu2.token)).status).toBe(404)
    expect(a.id).toBeDefined()
  })

  it('records proctoring flags and reports analytics + safe CSV', async () => {
    const t = await makeTest()
    const a = (await post(`/tests/${t.id}/start`, stu.token)).body
    expect((await post(`/attempts/${a.id}/events`, stu.token, { kind: 'tab_hidden' })).status).toBe(204)
    expect((await post(`/attempts/${a.id}/events`, stu.token, { kind: 'bogus' })).status).toBe(400)
    await post(`/attempts/${a.id}/submit`, stu.token, { answers: {} })
    const an = await request(app).get(`/api/tests/${t.id}/analytics`).set(as(teacher.token))
    expect(an.body).toMatchObject({ attempts: 1, flagged: 1, passRate: 0 })
    expect(an.body.distribution).toHaveLength(10)
    await request(app).patch(`/api/users/${stu.user.id}`).set(as(admin.token)).send({ role: 'student' })
    const csv = await request(app).get(`/api/tests/${t.id}/export.csv`).set(as(teacher.token))
    expect(csv.text).toContain('Stu')
    expect((await request(app).get(`/api/tests/${t.id}/analytics`).set(as(stu.token))).status).toBe(403)
    const mine = await request(app).get('/api/results').set(as(stu.token))
    expect(mine.body).toHaveLength(1)
    expect((await request(app).get('/api/results').set(as(stu2.token))).body).toHaveLength(0)
    expect((await request(app).get('/api/dashboard').set(as(stu.token))).body.completed).toBe(1)
  })
})
