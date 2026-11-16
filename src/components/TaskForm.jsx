import { useState } from 'react'
import { PRIORITIES, PRIORITIES_LIST } from '../utils/tasks.js'

export function TaskForm({ onAdd }) {
  const [value, setValue] = useState('')
  const [priority, setPriority] = useState(PRIORITIES.medium)
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    const title = value.trim()
    if (!title) return
    onAdd(title, { priority, notes, dueDate })
    setValue('')
    setPriority(PRIORITIES.medium)
    setNotes('')
    setDueDate('')
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <div className="task-form__row">
        <label className="visually-hidden" htmlFor="new-task">
          What needs to be done?
        </label>
        <input
          id="new-task"
          className="task-form__input"
          type="text"
          name="title"
          autoComplete="off"
          placeholder="What needs to be done?"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <label className="visually-hidden" htmlFor="new-task-priority">
          Priority
        </label>
        <select
          id="new-task-priority"
          className="task-form__priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          aria-label="Priority"
        >
          {PRIORITIES_LIST.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label} Priority
            </option>
          ))}
        </select>
        <button
          className="task-form__toggle"
          type="button"
          aria-expanded={isExpanded}
          aria-controls="task-form-details"
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? 'Hide details' : 'Add details'}
        </button>
        <button className="task-form__submit" type="submit" disabled={!value.trim()}>
          Add task
        </button>
      </div>

      <div id="task-form-details" className="task-form__details" hidden={!isExpanded}>
        <label className="visually-hidden" htmlFor="new-task-due">
          Due date
        </label>
        <input
          id="new-task-due"
          className="task-form__due"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          aria-label="Due date"
        />
        <label className="visually-hidden" htmlFor="new-task-notes">
          Notes
        </label>
        <textarea
          id="new-task-notes"
          className="task-form__notes"
          rows="2"
          value={notes}
          placeholder="Add a description or notes…"
          onChange={(event) => setNotes(event.target.value)}
          aria-label="Notes"
        />
      </div>
    </form>
  )
}
