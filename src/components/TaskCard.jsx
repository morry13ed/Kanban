import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import './TaskCard.css';

export default function TaskCard({
  task,
  boardId,
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
  canReorder,
  onDropOnTask,
}) {
  const { dispatch } = useApp();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  // 'top' | 'bottom' — which side of this card the drop would land on.
  const [dropEdge, setDropEdge] = useState(null);

  useEffect(() => {
    setTitleDraft(task.title);
  }, [task.title]);

  const isOverdue =
    task.dueDate && new Date(task.dueDate) < new Date() && !task.archived;

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleTitleClick = (e) => {
    e.stopPropagation();
    setIsEditingTitle(true);
  };

  const handleTitleSave = () => {
    const nextTitle = titleDraft.trim() || task.title;

    if (nextTitle !== task.title) {
      dispatch({
        type: 'UPDATE_TASK',
        payload: {
          boardId,
          taskId: task.id,
          updates: { title: nextTitle },
        },
      });
    }

    setTitleDraft(nextTitle);
    setIsEditingTitle(false);
  };

  const handleDragOver = (e) => {
    if (!canReorder || isDragging) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDropEdge(e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom');
  };

  const handleDragLeave = () => setDropEdge(null);

  const handleDrop = (e) => {
    if (!canReorder || isDragging || !dropEdge) return;
    // Beat the column's own drop handler, which appends to the end.
    e.preventDefault();
    e.stopPropagation();
    const edge = dropEdge;
    setDropEdge(null);
    onDropOnTask(task.id, edge);
  };

  return (
    <div
      className={`task-card ${isDragging ? 'dragging' : ''} ${
        dropEdge ? `drop-${dropEdge}` : ''
      }`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={() => {
        setDropEdge(null);
        onDragEnd();
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={onEdit}
    >
      <div className="task-card-header">
        {isEditingTitle ? (
          <input
            className="task-title-input"
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleTitleSave();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setTitleDraft(task.title);
                setIsEditingTitle(false);
              }
            }}
            autoFocus
          />
        ) : (
          <h4
            className="task-title"
            onClick={handleTitleClick}
            title="Click to rename task"
          >
            {task.title}
          </h4>
        )}
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
