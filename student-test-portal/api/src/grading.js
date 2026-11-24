const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

// Returns points earned for one question. Multiple-choice is all-or-nothing.
export function gradeQuestion(q, answer) {
  const correct = JSON.parse(q.correct)
  if (answer === undefined || answer === null) return 0
  switch (q.type) {
    case 'single':
    case 'truefalse':
      return Number(answer) === Number(correct[0]) && answer !== '' ? q.points : 0
    case 'multiple': {
      if (!Array.isArray(answer)) return 0
      const a = [...new Set(answer.map(Number))].sort()
      const c = [...correct].map(Number).sort()
      return a.length === c.length && a.every((v, i) => v === c[i]) ? q.points : 0
    }
    case 'short':
      return correct.some((c) => norm(c) === norm(answer)) ? q.points : 0
    default:
      return 0
  }
}

export function gradeAttempt(questions, answers) {
  let score = 0
  let max = 0
  for (const q of questions) {
    max += q.points
    score += gradeQuestion(q, answers[q.id])
  }
  return { score, max }
}

export function validateQuestion(q) {
  const types = ['single', 'multiple', 'truefalse', 'short']
  if (!q || typeof q.text !== 'string' || !q.text.trim()) return 'Question text required'
  if (!types.includes(q.type)) return 'Invalid question type'
  const points = q.points ?? 1
  if (!Number.isInteger(points) || points < 1 || points > 100) return 'Points must be 1-100'
  if (q.type === 'short') {
    if (!Array.isArray(q.correct) || !q.correct.length || q.correct.some((c) => typeof c !== 'string' || !c.trim()))
      return 'Short answer needs at least one accepted answer'
    return null
  }
  const options = q.type === 'truefalse' ? ['True', 'False'] : q.options
  if (!Array.isArray(options) || options.length < 2 || options.length > 8 || options.some((o) => typeof o !== 'string' || !o.trim()))
    return 'Provide 2-8 non-empty options'
  if (!Array.isArray(q.correct) || !q.correct.length) return 'Mark the correct answer'
  if (q.correct.some((c) => !Number.isInteger(c) || c < 0 || c >= options.length)) return 'Correct answer out of range'
  if (q.type !== 'multiple' && q.correct.length !== 1) return 'Exactly one correct answer required'
  return null
}
