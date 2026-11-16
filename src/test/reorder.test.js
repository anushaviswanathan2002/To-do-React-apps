import { describe, expect, it } from 'vitest'
import { partitionTasks, reorderTasks, setTaskCompleted } from '../utils/tasks.js'

function makeTask(id, overrides = {}) {
  return {
    id,
    title: id,
    priority: 'medium',
    notes: '',
    dueDate: '',
    completed: false,
    completedAt: null,
    createdAt: 0,
    ...overrides,
  }
}

const ids = (tasks) => tasks.map((task) => task.id)

describe('partitionTasks', () => {
  it('moves completed tasks after active ones', () => {
    const tasks = [
      makeTask('a', { completed: true }),
      makeTask('b'),
      makeTask('c', { completed: true }),
      makeTask('d'),
    ]
    expect(ids(partitionTasks(tasks))).toEqual(['b', 'd', 'a', 'c'])
  })

  it('preserves relative order inside each group', () => {
    const tasks = [
      makeTask('a'),
      makeTask('b'),
      makeTask('c', { completed: true }),
      makeTask('d', { completed: true }),
    ]
    expect(ids(partitionTasks(tasks))).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('setTaskCompleted', () => {
  it('sinks a completed task to the bottom of the list', () => {
    const tasks = [makeTask('a'), makeTask('b'), makeTask('c')]
    const result = setTaskCompleted(tasks, 'a', true)
    expect(ids(result)).toEqual(['b', 'c', 'a'])
    expect(result.find((task) => task.id === 'a').completed).toBe(true)
  })

  it('records a completion timestamp', () => {
    const tasks = [makeTask('a'), makeTask('b')]
    const result = setTaskCompleted(tasks, 'a', true)
    expect(result.find((task) => task.id === 'a').completedAt).toBeTypeOf('number')
  })

  it('clears the completion timestamp when reopened', () => {
    const tasks = [makeTask('a', { completed: true, completedAt: 123 })]
    const result = setTaskCompleted(tasks, 'a', false)
    expect(result[0].completed).toBe(false)
    expect(result[0].completedAt).toBeNull()
  })

  it('lifts a reopened task back to the end of the active section', () => {
    const tasks = [makeTask('a'), makeTask('b', { completed: true }), makeTask('c')]
    const result = setTaskCompleted(tasks, 'b', false)
    expect(ids(result)).toEqual(['a', 'c', 'b'])
  })

  it('keeps active tasks above completed ones after toggling', () => {
    const tasks = [makeTask('a'), makeTask('b'), makeTask('c')]
    const result = setTaskCompleted(setTaskCompleted(tasks, 'a', true), 'c', true)
    expect(ids(result)).toEqual(['b', 'a', 'c'])
  })

  it('returns the same list when the task does not exist', () => {
    const tasks = [makeTask('a')]
    expect(setTaskCompleted(tasks, 'missing', true)).toBe(tasks)
  })
})

describe('reorderTasks', () => {
  it('moves a task to a new position', () => {
    const tasks = [makeTask('a'), makeTask('b'), makeTask('c')]
    const result = reorderTasks(tasks, ['a', 'b', 'c'], 0, 2)
    expect(ids(result)).toEqual(['b', 'c', 'a'])
  })

  it('leaves the list untouched when the index is unchanged', () => {
    const tasks = [makeTask('a'), makeTask('b'), makeTask('c')]
    expect(reorderTasks(tasks, ['a', 'b', 'c'], 1, 1)).toBe(tasks)
  })

  it('ignores out-of-range indexes', () => {
    const tasks = [makeTask('a'), makeTask('b')]
    expect(reorderTasks(tasks, ['a', 'b'], 0, 5)).toBe(tasks)
    expect(reorderTasks(tasks, ['a', 'b'], -1, 0)).toBe(tasks)
  })

  it('reorders only the visible tasks and keeps hidden ones in place', () => {
    const tasks = [makeTask('a'), makeTask('b'), makeTask('c'), makeTask('d')]
    // Only 'a' and 'c' are visible (filtered view). They swap their slots
    // (positions 0 and 2) while 'b' and 'd' stay exactly where they were.
    const result = reorderTasks(tasks, ['a', 'c'], 0, 1)
    expect(ids(result)).toEqual(['c', 'b', 'a', 'd'])
  })

  it('keeps active tasks above completed ones after a reorder', () => {
    const tasks = [
      makeTask('a'),
      makeTask('b', { completed: true }),
      makeTask('c'),
    ]
    const result = reorderTasks(tasks, ['a', 'b', 'c'], 2, 0)
    expect(ids(result)).toEqual(['c', 'a', 'b'])
  })

  it('preserves the task objects', () => {
    const tasks = [makeTask('a', { title: 'Keep me' }), makeTask('b')]
    const result = reorderTasks(tasks, ['a', 'b'], 0, 1)
    expect(result.find((task) => task.id === 'a').title).toBe('Keep me')
  })
})
