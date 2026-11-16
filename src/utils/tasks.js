export const FILTERS = {
  all: 'all',
  active: 'active',
  completed: 'completed',
}

export const FILTERS_LIST = [
  { value: FILTERS.all, label: 'All' },
  { value: FILTERS.active, label: 'Active' },
  { value: FILTERS.completed, label: 'Completed' },
]

export const PRIORITIES = {
  low: 'low',
  medium: 'medium',
  high: 'high',
}

export const PRIORITIES_LIST = [
  { value: PRIORITIES.low, label: 'Low' },
  { value: PRIORITIES.medium, label: 'Medium' },
  { value: PRIORITIES.high, label: 'High' },
]

export function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createTask(title, priority = PRIORITIES.medium) {
  const validPriority = PRIORITIES[priority] ? priority : PRIORITIES.medium
  return {
    id: createId(),
    title: title.trim(),
    priority: validPriority,
    completed: false,
    createdAt: Date.now(),
  }
}

export function filterTasks(tasks, filter) {
  if (filter === FILTERS.active) return tasks.filter((task) => !task.completed)
  if (filter === FILTERS.completed) return tasks.filter((task) => task.completed)
  return tasks
}

export function countTasks(tasks) {
  return {
    total: tasks.length,
    active: tasks.filter((task) => !task.completed).length,
    completed: tasks.filter((task) => task.completed).length,
  }
}
