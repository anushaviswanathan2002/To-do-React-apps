import { describe, expect, it } from 'vitest'
import {
  formatDueDate,
  isDueToday,
  isOverdue,
  shiftDate,
  toDateInputValue,
  todayDateValue,
} from '../utils/dates.js'

describe('date utilities', () => {
  it('formats a date for an HTML date input', () => {
    expect(toDateInputValue(new Date(2025, 0, 5))).toBe('2025-01-05')
    expect(toDateInputValue(new Date(2025, 11, 31))).toBe('2025-12-31')
  })

  it('returns today in ISO form', () => {
    const today = todayDateValue()
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('shifts a date by a number of days', () => {
    expect(shiftDate('2025-01-01', 1)).toBe('2025-01-02')
    expect(shiftDate('2025-01-01', -1)).toBe('2024-12-31')
    expect(shiftDate('2025-01-31', 1)).toBe('2025-02-01')
  })

  it('detects overdue tasks', () => {
    expect(isOverdue({ dueDate: '2025-01-01', completed: false }, '2025-01-02')).toBe(true)
    expect(isOverdue({ dueDate: '2025-01-02', completed: false }, '2025-01-02')).toBe(false)
    expect(isOverdue({ dueDate: '2025-01-03', completed: false }, '2025-01-02')).toBe(false)
  })

  it('does not flag completed tasks as overdue', () => {
    expect(isOverdue({ dueDate: '2025-01-01', completed: true }, '2025-01-02')).toBe(false)
  })

  it('ignores tasks without a due date', () => {
    expect(isOverdue({ dueDate: '', completed: false }, '2025-01-02')).toBe(false)
    expect(isOverdue({ completed: false }, '2025-01-02')).toBe(false)
  })

  it('detects tasks due today', () => {
    expect(isDueToday({ dueDate: '2025-01-02', completed: false }, '2025-01-02')).toBe(true)
    expect(isDueToday({ dueDate: '2025-01-03', completed: false }, '2025-01-02')).toBe(false)
    expect(isDueToday({ dueDate: '2025-01-02', completed: true }, '2025-01-02')).toBe(false)
  })

  it('formats due dates with friendly relative labels', () => {
    expect(formatDueDate('2025-01-02', '2025-01-02')).toBe('Today')
    expect(formatDueDate('2025-01-03', '2025-01-02')).toBe('Tomorrow')
    expect(formatDueDate('2025-01-01', '2025-01-02')).toBe('Yesterday')
    expect(formatDueDate('2025-03-15', '2025-01-02')).toBe('15 Mar 2025')
    expect(formatDueDate('', '2025-01-02')).toBe('')
  })
})
