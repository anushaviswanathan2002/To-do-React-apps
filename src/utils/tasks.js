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

export function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createTask(title) {
  return {
    id: createId(),
    title: title.trim(),
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
