// Local, dependency-free AI utilities (TF-IDF retrieval, recommenders, classifiers, forecasting)
// plus an optional OpenAI-compatible LLM client used only when AI_API_KEY is configured.

const STOP = new Set('a an and are as at be by for from has have in is it its of on or that the this to was were will with about book books read me i my show find any some want looking recommend'.split(' '))
const SYNONYMS = {
  scifi: 'science fiction', 'sci-fi': 'science fiction', programming: 'software code', coding: 'software code',
  novel: 'fiction', history: 'historical', kids: 'children', cooking: 'food cuisine', ai: 'artificial intelligence machine learning',
}

export function stem(w) {
  return w.replace(/(ing|edly|ed|ies|es|s|ly)$/, (m) => (m === 'ies' ? 'y' : '')).replace(/(.)\1$/, '$1')
}

export function tokenize(text) {
  const expanded = String(text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/).map((w) => SYNONYMS[w] || w).join(' ')
  return expanded.split(/[\s-]+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem)
}

const bookText = (b) => `${b.title} ${b.title} ${b.author} ${b.category} ${b.category} ${b.description || ''}`

export function buildIndex(books) {
  const docs = books.map((b) => {
    const tf = new Map()
    for (const t of tokenize(bookText(b))) tf.set(t, (tf.get(t) || 0) + 1)
    return { book: b, tf }
  })
  const df = new Map()
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) || 0) + 1)
  const n = docs.length
  const idf = (t) => Math.log(1 + n / (1 + (df.get(t) || 0)))
  for (const d of docs) {
    d.vec = new Map([...d.tf].map(([t, c]) => [t, (1 + Math.log(c)) * idf(t)]))
    d.norm = Math.sqrt([...d.vec.values()].reduce((s, v) => s + v * v, 0)) || 1
  }
  const vectorize = (text) => {
    const tf = new Map()
    for (const t of tokenize(text)) tf.set(t, (tf.get(t) || 0) + 1)
    const vec = new Map([...tf].map(([t, c]) => [t, (1 + Math.log(c)) * idf(t)]))
    return { vec, norm: Math.sqrt([...vec.values()].reduce((s, v) => s + v * v, 0)) || 1 }
  }
  return { docs, vectorize }
}

export function cosine(a, b) {
  let dot = 0
  const [small, big] = a.vec.size < b.vec.size ? [a, b] : [b, a]
  for (const [t, w] of small.vec) dot += w * (big.vec.get(t) || 0)
  return dot / (a.norm * b.norm)
}

export function semanticSearch(books, query, limit = 10) {
  const idx = buildIndex(books)
  const q = idx.vectorize(query)
  if (q.vec.size === 0) return []
  return idx.docs
    .map((d) => ({ book: d.book, score: cosine(q, d) }))
    .filter((r) => r.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => ({ ...r.book, score: Number(r.score.toFixed(3)) }))
}

export function similarBooks(books, bookId, limit = 5) {
  const idx = buildIndex(books)
  const me = idx.docs.find((d) => d.book.id === bookId)
  if (!me) return []
  return idx.docs.filter((d) => d !== me)
    .map((d) => ({ ...d.book, score: Number(cosine(me, d).toFixed(3)) }))
    .filter((r) => r.score > 0.05).sort((a, b) => b.score - a.score).slice(0, limit)
}

// Hybrid recommender: content profile from the member's history + collaborative co-borrowing.
export function recommend(books, loans, userId, limit = 5) {
  const mine = new Set(loans.filter((l) => l.user_id === userId).map((l) => l.book_id))
  const byBook = new Map(books.map((b) => [b.id, b]))
  const scores = new Map()
  const reasons = new Map()
  const add = (id, s, why) => {
    if (mine.has(id) || !byBook.has(id)) return
    scores.set(id, (scores.get(id) || 0) + s)
    if (!reasons.has(id) || s > reasons.get(id).s) reasons.set(id, { s, why })
  }
  if (mine.size) {
    const idx = buildIndex(books)
    const profile = idx.vectorize([...mine].map((id) => byBook.get(id)).filter(Boolean).map(bookText).join(' '))
    for (const d of idx.docs) {
      const s = cosine(profile, d)
      if (s > 0.05) add(d.book.id, s, 'Matches your reading history')
    }
    const neighbours = new Map()
    for (const l of loans) {
      if (l.user_id !== userId && mine.has(l.book_id)) neighbours.set(l.user_id, (neighbours.get(l.user_id) || 0) + 1)
    }
    for (const l of loans) {
      const w = neighbours.get(l.user_id)
      if (w) add(l.book_id, 0.3 * w, 'Readers with similar taste borrowed this')
    }
  }
  const pop = new Map()
  for (const l of loans) pop.set(l.book_id, (pop.get(l.book_id) || 0) + 1)
  const max = Math.max(1, ...pop.values())
  for (const b of books) add(b.id, 0.1 * ((pop.get(b.id) || 0) / max), 'Popular in the library')
  return [...scores].sort((a, b) => b[1] - a[1]).slice(0, limit)
    .map(([id, s]) => ({ ...byBook.get(id), score: Number(s.toFixed(3)), reason: reasons.get(id).why }))
}

const CATEGORY_KEYWORDS = {
  'Science Fiction': 'space alien future robot galaxy planet dystopia time travel cyberpunk starship',
  Fantasy: 'dragon wizard magic kingdom sword elf quest sorcery myth',
  Mystery: 'detective murder crime investigation clue thriller suspect killer police',
  Romance: 'love romance heart wedding passion relationship',
  Technology: 'software programming code algorithm computer data javascript python database network machine learning artificial intelligence web',
  Science: 'physics chemistry biology universe evolution quantum scientific research cosmos',
  History: 'war empire ancient century revolution historical civilization medieval',
  Biography: 'life memoir autobiography biography story of his her',
  Business: 'business management leadership startup marketing finance economics entrepreneur investing',
  'Self-Help': 'habit productivity mindset happiness success motivation mindfulness',
  Children: 'children kids picture bedtime adventure fairy tale young',
  Cooking: 'recipe cooking cuisine kitchen baking food chef',
  Philosophy: 'philosophy ethics meaning existence reason wisdom stoic',
}

export function categorize({ title = '', author = '', description = '' }) {
  const q = tokenize(`${title} ${title} ${description} ${author}`)
  const set = new Map()
  for (const t of q) set.set(t, (set.get(t) || 0) + 1)
  const ranked = Object.entries(CATEGORY_KEYWORDS).map(([cat, kw]) => {
    const kws = new Set(tokenize(kw))
    let s = 0
    for (const [t, c] of set) if (kws.has(t)) s += c
    return { category: cat, score: s }
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score)
  const total = ranked.reduce((s, r) => s + r.score, 0) || 1
  const suggestions = ranked.slice(0, 3).map((r) => ({ category: r.category, confidence: Number((r.score / total).toFixed(2)) }))
  const tags = [...set].filter(([t]) => t.length > 3).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, 5).map(([t]) => t)
  return { suggestions, tags }
}

export function extractiveDescription(b) {
  const parts = [`"${b.title}" by ${b.author} is a ${b.category.toLowerCase()} title in our collection.`]
  const cat = categorize(b).tags
  if (cat.length) parts.push(`Key themes: ${cat.join(', ')}.`)
  return parts.join(' ')
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')
export const similarity = (a, b) => {
  const x = norm(a), y = norm(b)
  const m = Math.max(x.length, y.length)
  return m === 0 ? 1 : 1 - levenshtein(x, y) / m
}

export function findDuplicates(books, threshold = 0.85) {
  const out = []
  for (let i = 0; i < books.length; i++)
    for (let j = i + 1; j < books.length; j++) {
      const t = similarity(books[i].title, books[j].title)
      const a = similarity(books[i].author, books[j].author)
      const sim = t * 0.7 + a * 0.3
      if (t >= threshold && a >= 0.6) out.push({ a: books[i], b: books[j], similarity: Number(sim.toFixed(2)) })
    }
  return out.sort((x, y) => y.similarity - x.similarity)
}

// Probability-style score (0..1) that an active loan will be returned late.
export function overdueRisk(loan, history, nowDate) {
  const past = history.filter((l) => l.user_id === loan.user_id && l.returned_at)
  const late = past.filter((l) => l.returned_at > l.due_at).length
  const rate = (late + 0.5) / (past.length + 1)
  const due = new Date(loan.due_at).getTime()
  const daysLeft = (due - nowDate.getTime()) / 86400000
  const timePressure = daysLeft <= 0 ? 1 : Math.max(0, 1 - daysLeft / 14)
  const renewals = Math.min(1, loan.renewals / 2)
  return Number(Math.min(1, 0.5 * rate + 0.4 * timePressure + 0.1 * renewals).toFixed(2))
}

// Demand forecasting: loans per 30 days (recent-weighted) + reservation pressure -> copies to acquire.
export function acquisitionSuggestions(books, loans, reservations, nowDate) {
  const t = nowDate.getTime()
  return books.map((b) => {
    const bl = loans.filter((l) => l.book_id === b.id)
    const recent = bl.filter((l) => t - new Date(l.borrowed_at).getTime() <= 30 * 86400000).length
    const older = bl.length - recent
    const waiting = reservations.filter((r) => r.book_id === b.id && r.status === 'waiting').length
    const demand = recent * 1 + older * 0.25 + waiting * 2
    const capacity = Math.max(1, b.total_copies)
    const pressure = demand / capacity
    const suggestedCopies = pressure >= 2 || waiting >= 2 ? Math.min(5, Math.max(1, Math.ceil(waiting / 2) + Math.floor(pressure / 3))) : 0
    return { id: b.id, title: b.title, author: b.author, copies: b.total_copies, recentLoans: recent, waiting, demandScore: Number(demand.toFixed(2)), suggestedCopies }
  }).filter((x) => x.suggestedCopies > 0).sort((a, b) => b.demandScore - a.demandScore)
}

// Intent-based assistant. `ctx` supplies data accessors so this stays pure/testable.
export function detectIntent(msg) {
  const m = msg.toLowerCase()
  if (/\b(fine|fines|owe|penalt)/.test(m)) return 'fines'
  if (/\b(due|overdue|return|when.*back|my loans?|borrowed|checked out)/.test(m)) return 'loans'
  if (/\b(similar|like)\b.+/.test(m) && /\b(similar to|like)\b/.test(m)) return 'similar'
  if (/\b(recommend|suggest|what should i read|next read)/.test(m)) return 'recommend'
  if (/\b(renew|extend)/.test(m)) return 'renew'
  if (/\b(hours|open|closing|location|address)/.test(m)) return 'hours'
  if (/\b(hi|hello|hey|help)\b/.test(m)) return 'help'
  return 'search'
}

export async function callLLM(messages, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (!env.AI_API_KEY) return null
  const base = (env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  try {
    const res = await fetchImpl(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.AI_API_KEY}` },
      body: JSON.stringify({ model: env.AI_MODEL || 'gpt-4o-mini', messages, temperature: 0.4, max_tokens: 400 }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() || null
  } catch {
    return null
  }
}
