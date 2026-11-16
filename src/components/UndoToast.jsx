export function UndoToast({ message, onUndo, onDismiss }) {
  return (
    <aside className="toast" role="status" aria-live="polite">
      <span className="toast__message">{message}</span>
      <div className="toast__actions">
        <button className="toast__undo" type="button" onClick={onUndo}>
          Undo
        </button>
        <button
          className="toast__dismiss"
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </aside>
  )
}
