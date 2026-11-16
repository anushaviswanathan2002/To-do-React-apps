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

export function createTask(title, options = {}) {
  const { priority = PRIORITIES.medium, notes = '', dueDate = '' } = options
  const validPriority = PRIORITIES[priority] ? priority : PRIORITIES.medium
  return {
    id: createId(),
    title: title.trim(),
    priority: validPriority,
    notes: notes.trim(),
    dueDate,
    completed: false,
    completedAt: null,
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

// Active tasks always come before completed ones. Order within each group is preserved.
export function partitionTasks(tasks) {
  return [...tasks.filter((task) => !task.completed), ...tasks.filter((task) => task.completed)]
}

export function setTaskCompleted(tasks, id, completed) {
  const index = tasks.findIndex((task) => task.id === id)
  if (index === -1) return tasks

  const existing = tasks[index]
  const updated = {
    ...existing,
    completed,
    completedAt: completed ? (existing.completedAt ?? Date.now()) : null,
  }
  const rest = tasks.filter((task) => task.id !== id)

  if (completed) {
    // Completed tasks sink to the bottom, most recently completed last.
    return partitionTasks([...rest, updated])
  }

  // Reopening lifts the task back to the end of the active section.
  const lastActiveIndex = rest.reduce((acc, task, i) => (task.completed ? acc : i), -1)
  const insertAt = lastActiveIndex + 1
  return partitionTasks([...rest.slice(0, insertAt), updated, ...rest.slice(insertAt)])
}

// Applies a drag to the visible subset of tasks while leaving filtered-out
// tasks where they are, then restores the active-before-completed grouping.
export function reorderTasks(allTasks, visibleIds, fromIndex, toIndex) {
  if (fromIndex === toIndex) return allTasks
  if (fromIndex < 0 || toIndex < 0) return allTasks
  if (fromIndex >= visibleIds.length || toIndex >= visibleIds.length) return allTasks

  const reordered = [...visibleIds]
  const [moved] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, moved)

  const byId = new Map(allTasks.map((task) => [task.id, task]))
  const visibleSet = new Set(visibleIds)
  let cursor = 0

  const merged = allTasks.map((task) => {
    if (!visibleSet.has(task.id)) return task
    const next = byId.get(reordered[cursor])
    cursor += 1
    return next
  })

  return partitionTasks(merged)
}
