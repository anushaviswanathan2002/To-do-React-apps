import { TaskItem } from './TaskItem.jsx'

export function TaskList({ tasks, onToggle, onRemove, onRename, filter }) {
  if (tasks.length === 0) {
    const message =
      filter === 'completed'
        ? 'No completed tasks yet.'
        : filter === 'active'
          ? 'Nothing left to do. Nice work!'
          : 'No tasks yet. Add your first one above.'

    return (
      <div className="empty-state">
        <span className="empty-state__icon" aria-hidden="true">
          ✓
        </span>
        <p className="empty-state__message">{message}</p>
      </div>
    )
  }

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={onToggle}
          onRemove={onRemove}
          onRename={onRename}
        />
      ))}
    </ul>
  )
}
