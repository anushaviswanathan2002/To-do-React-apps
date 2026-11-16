import { useEffect, useRef, useState } from 'react'
import { CheckIcon, PencilIcon, TrashIcon } from './Icon.jsx'
import { PRIORITIES, PRIORITIES_LIST } from '../utils/tasks.js'
import { formatDueDate, isDueToday, isOverdue } from '../utils/dates.js'

export function TaskItem({ task, onToggle, onRemove, onUpdate, today }) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(task.title)
  const [draftPriority, setDraftPriority] = useState(task.priority || PRIORITIES.medium)
  const [draftNotes, setDraftNotes] = useState(task.notes || '')
  const [draftDueDate, setDraftDueDate] = useState(task.dueDate || '')
  const [showNotes, setShowNotes] = useState(false)
  const inputRef = useRef(null)
  const isEditingRef = useRef(false)
  const formRef = useRef(null)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  function startEditing() {
    isEditingRef.current = true
    setDraftTitle(task.title)
    setDraftPriority(task.priority || PRIORITIES.medium)
    setDraftNotes(task.notes || '')
    setDraftDueDate(task.dueDate || '')
    setIsEditing(true)
  }

  function saveEditing() {
    if (!isEditingRef.current) return
    isEditingRef.current = false
    const title = draftTitle.trim()
    if (title) {
      onUpdate(task.id, {
        title,
        priority: draftPriority,
        notes: draftNotes.trim(),
        dueDate: draftDueDate,
      })
    }
    setIsEditing(false)
  }

  function cancelEditing() {
    if (!isEditingRef.current) return
    isEditingRef.current = false
    setDraftTitle(task.title)
    setDraftPriority(task.priority || PRIORITIES.medium)
    setDraftNotes(task.notes || '')
    setDraftDueDate(task.dueDate || '')
    setIsEditing(false)
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelEditing()
    }
    if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') {
      event.preventDefault()
      saveEditing()
    }
  }

  function handleBlur(event) {
    // Only save on blur if focus left the entire edit container
    if (formRef.current && !formRef.current.contains(event.relatedTarget)) {
      saveEditing()
    }
  }

  const priority = task.priority || PRIORITIES.medium
  const notes = task.notes || ''
  const overdue = isOverdue(task, today)
  const dueToday = isDueToday(task, today)

  if (isEditing) {
    return (
      <li className="task task--editing" ref={formRef} onBlur={handleBlur}>
        <div className="task__edit-fields">
          <input
            ref={inputRef}
            className="task__edit-input"
            type="text"
            value={draftTitle}
            aria-label={`Edit task: ${task.title}`}
            onChange={(event) => setDraftTitle(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <select
            className="task__edit-priority"
            value={draftPriority}
            onChange={(event) => setDraftPriority(event.target.value)}
            aria-label="Change priority"
            onKeyDown={handleKeyDown}
          >
            {PRIORITIES_LIST.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            className="task__edit-due"
            type="date"
            value={draftDueDate}
            onChange={(event) => setDraftDueDate(event.target.value)}
            aria-label="Change due date"
            onKeyDown={handleKeyDown}
          />
          <textarea
            className="task__edit-notes"
            rows="2"
            value={draftNotes}
            placeholder="Notes…"
            aria-label="Edit notes"
            onChange={(event) => setDraftNotes(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="task__actions">
          <button
            className="task__action task__action--save"
            type="button"
            aria-label="Save task"
            onClick={saveEditing}
          >
            <CheckIcon />
          </button>
          <button
            className="task__action"
            type="button"
            aria-label="Cancel editing"
            onClick={cancelEditing}
          >
            Cancel
          </button>
        </div>
      </li>
    )
  }

  const dueLabel = task.dueDate ? formatDueDate(task.dueDate, today) : ''

  return (
    <li className={`task${task.completed ? ' task--completed' : ''}${overdue ? ' task--overdue' : ''}`}>
      <label className="task__label">
        <input
          className="task__checkbox"
          type="checkbox"
          checked={task.completed}
          onChange={() => onToggle(task.id)}
        />
        <span className="task__checkmark" aria-hidden="true">
          <CheckIcon />
        </span>
        <span className="task__title">{task.title}</span>
        {task.dueDate && (
          <span
            className={`task__due${overdue ? ' task__due--overdue' : ''}${dueToday ? ' task__due--today' : ''}`}
          >
            {overdue ? 'Overdue' : dueLabel}
          </span>
        )}
        <span className={`task__priority-badge task__priority-badge--${priority}`}>
          {priority}
        </span>
      </label>

      <div className="task__actions">
        {notes && (
          <button
            className="task__action task__action--notes"
            type="button"
            aria-expanded={showNotes}
            aria-label={`${showNotes ? 'Hide' : 'Show'} notes for task: ${task.title}`}
            onClick={() => setShowNotes((current) => !current)}
          >
            Notes
          </button>
        )}
        <button
          className="task__action"
          type="button"
          onClick={startEditing}
          aria-label={`Edit task: ${task.title}`}
        >
          <PencilIcon />
        </button>
        <button
          className="task__action task__action--danger"
          type="button"
          onClick={() => onRemove(task.id)}
          aria-label={`Delete task: ${task.title}`}
        >
          <TrashIcon />
        </button>
      </div>

      {notes && showNotes && <p className="task__notes">{notes}</p>}
    </li>
  )
}
