import { useEffect, useRef, useState } from 'react'
import { CheckIcon, PencilIcon, TrashIcon } from './Icon.jsx'

export function TaskItem({ task, onToggle, onRemove, onRename }) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const inputRef = useRef(null)
  const isEditingRef = useRef(false)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  function startEditing() {
    isEditingRef.current = true
    setDraft(task.title)
    setIsEditing(true)
  }

  // Whichever of save/cancel/blur fires first wins; the rest become no-ops.
  function saveEditing() {
    if (!isEditingRef.current) return
    isEditingRef.current = false
    const title = draft.trim()
    if (title) onRename(task.id, title)
    setIsEditing(false)
  }

  function cancelEditing() {
    if (!isEditingRef.current) return
    isEditingRef.current = false
    setDraft(task.title)
    setIsEditing(false)
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelEditing()
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      saveEditing()
    }
  }

  if (isEditing) {
    return (
      <li className="task task--editing">
        <input
          ref={inputRef}
          className="task__edit-input"
          type="text"
          value={draft}
          aria-label={`Edit task: ${task.title}`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={saveEditing}
        />
        <button
          className="task__action task__action--save"
          type="button"
          aria-label="Save task"
          onMouseDown={saveEditing}
        >
          <CheckIcon />
        </button>
        <button
          className="task__action"
          type="button"
          aria-label="Cancel editing"
          onMouseDown={cancelEditing}
        >
          Cancel
        </button>
      </li>
    )
  }

  return (
    <li className={`task${task.completed ? ' task--completed' : ''}`}>
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
      </label>

      <div className="task__actions">
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
    </li>
  )
}
