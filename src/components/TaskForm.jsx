import { useState } from 'react'
import { PRIORITIES, PRIORITIES_LIST } from '../utils/tasks.js'

export function TaskForm({ onAdd }) {
  const [value, setValue] = useState('')
  const [priority, setPriority] = useState(PRIORITIES.medium)

  function handleSubmit(event) {
    event.preventDefault()
    const title = value.trim()
    if (!title) return
    onAdd(title, priority)
    setValue('')
    setPriority(PRIORITIES.medium)
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
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
      <button className="task-form__submit" type="submit" disabled={!value.trim()}>
        Add task
      </button>
    </form>
  )
}
