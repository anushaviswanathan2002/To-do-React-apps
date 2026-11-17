import { describe, expect, it } from 'vitest'
import { countByPriority, filterTasksByPriority, PRIORITY_FILTERS } from '../utils/tasks.js'

function makeTask(id, priority, overrides = {}) {
  return {
    id,
    title: id,
    priority,
    notes: '',
    dueDate: '',
    completed: false,
    completedAt: null,
    createdAt: 0,
    ...overrides,
  }
}

const ids = (tasks) => tasks.map((task) => task.id)

describe('filterTasksByPriority', () => {
  const tasks = [
    makeTask('a', 'low'),
    makeTask('b', 'medium'),
    makeTask('c', 'high'),
    makeTask('d', 'low'),
  ]

  it('returns every task for the "all" filter', () => {
    expect(ids(filterTasksByPriority(tasks, PRIORITY_FILTERS.all))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('returns every task when no filter is given', () => {
    expect(ids(filterTasksByPriority(tasks, undefined))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('filters to low priority tasks', () => {
    expect(ids(filterTasksByPriority(tasks, PRIORITY_FILTERS.low))).toEqual(['a', 'd'])
  })

  it('filters to medium priority tasks', () => {
    expect(ids(filterTasksByPriority(tasks, PRIORITY_FILTERS.medium))).toEqual(['b'])
  })

  it('filters to high priority tasks', () => {
    expect(ids(filterTasksByPriority(tasks, PRIORITY_FILTERS.high))).toEqual(['c'])
  })

  it('treats a task without a priority as medium', () => {
    const withoutPriority = [makeTask('x', 'medium', { priority: undefined })]
    expect(ids(filterTasksByPriority(withoutPriority, PRIORITY_FILTERS.medium))).toEqual(['x'])
    expect(ids(filterTasksByPriority(withoutPriority, PRIORITY_FILTERS.high))).toEqual([])
  })
})

describe('countByPriority', () => {
  it('counts tasks in each priority bucket', () => {
    const tasks = [
      makeTask('a', 'low'),
      makeTask('b', 'medium'),
      makeTask('c', 'high'),
      makeTask('d', 'low'),
    ]
    expect(countByPriority(tasks)).toEqual({ all: 4, low: 2, medium: 1, high: 1 })
  })

  it('counts a task without a priority as medium', () => {
    const tasks = [makeTask('a', 'medium', { priority: undefined })]
    expect(countByPriority(tasks)).toEqual({ all: 1, low: 0, medium: 1, high: 0 })
  })
})
