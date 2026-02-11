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
}) {
  const { dispatch } = useApp();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);

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
