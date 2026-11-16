const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function toDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayDateValue(now = new Date()) {
  return toDateInputValue(now)
}

export function shiftDate(dateValue, days) {
  const [year, month, day] = dateValue.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return toDateInputValue(date)
}

// ISO date strings (YYYY-MM-DD) sort lexicographically, so a plain compare is enough.
export function isOverdue(task, today = todayDateValue()) {
  if (task.completed || !task.dueDate) return false
  return task.dueDate < today
}

export function isDueToday(task, today = todayDateValue()) {
  if (task.completed || !task.dueDate) return false
  return task.dueDate === today
}

export function formatDueDate(dueDate, today = todayDateValue()) {
  if (!dueDate) return ''
  if (dueDate === today) return 'Today'
  if (dueDate === shiftDate(today, 1)) return 'Tomorrow'
  if (dueDate === shiftDate(today, -1)) return 'Yesterday'

  const [year, month, day] = dueDate.split('-').map(Number)
  return `${day} ${MONTHS[month - 1]} ${year}`
}
