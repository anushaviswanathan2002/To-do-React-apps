import { useState } from 'react'

export function TaskForm({ onAdd }) {
  const [value, setValue] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const title = value.trim()
    if (!title) return
    onAdd(title)
    setValue('')
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
      <button className="task-form__submit" type="submit" disabled={!value.trim()}>
        Add task
      </button>
    </form>
  )
}
