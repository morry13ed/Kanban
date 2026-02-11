import './TaskCard.css';

export default function TaskCard({
  task,
  isFirst,
  isLast,
  onEdit,
  onMoveLeft,
  onMoveRight,
  onComplete,
  onArchive,
  onDelete,
  onDragStart,
  onDragEnd,
  isDragging,
}) {
  const isOverdue =
    task.dueDate && new Date(task.dueDate) < new Date() && !task.archived;

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      className={`task-card ${isDragging ? 'dragging' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onEdit}
    >
      <div className="task-card-header">
        <h4 className="task-title">{task.title}</h4>
      </div>

      {task.description && (
        <p className="task-description">{task.description}</p>
      )}

      <div className="task-meta">
        {task.assignee !== 'Unassigned' && (
          <span className="task-assignee">
            <span className="assignee-avatar">
              {task.assignee.charAt(0)}
            </span>
            {task.assignee}
          </span>
        )}
        {task.dueDate && (
          <span className={`task-due ${isOverdue ? 'overdue' : ''}`}>
            {formatDate(task.dueDate)}
          </span>
        )}
      </div>

      <div className="task-actions" onClick={(e) => e.stopPropagation()}>
        {!isFirst && (
          <button
            className="task-action-btn"
            onClick={onMoveLeft}
            title="Move left"
          >
            ←
          </button>
        )}
        {!isLast && (
          <button
            className="task-action-btn"
            onClick={onMoveRight}
            title="Move right"
          >
            →
          </button>
        )}
        {!isLast && (
          <button
            className="task-action-btn complete"
            onClick={onComplete}
            title="Complete"
          >
            ✓
          </button>
        )}
        {isLast && (
          <button
            className="task-action-btn archive"
            onClick={onArchive}
            title="Archive"
          >
            📦
          </button>
        )}
        <button
          className="task-action-btn danger"
          onClick={onDelete}
          title="Delete"
        >
          🗑
        </button>
      </div>
    </div>
  );
}
