import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  getPriority,
  getMemberColor,
  readableTextOn,
  STATUS_ACTIVE,
  STATUS_PAUSED,
} from '../utils/helpers';
import './TaskCard.css';

function BugIcon() {
  return (
    <svg className="bug-icon" viewBox="0 0 16 16" aria-hidden="true">
      {/* Antennae and legs stay thin; the body is solid so the silhouette
          still reads as a beetle at 11px rather than a starburst. */}
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      >
        <path d="M5.7 2.7 7.1 4.6M10.3 2.7 8.9 4.6" />
        <path d="M4.7 8.2H2.1M4.9 11.3 2.9 12.6M11.3 8.2h2.6M11.1 11.3l2 1.3" />
      </g>
      <rect x="4.7" y="4.5" width="6.6" height="9" rx="3.3" fill="currentColor" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="status-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.5 2.8v10.4c0 .8.9 1.3 1.6.9l8-5.2c.6-.4.6-1.4 0-1.8l-8-5.2c-.7-.4-1.6.1-1.6.9z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="status-icon" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3.5" y="2.5" width="3.4" height="11" rx="1.2" fill="currentColor" />
      <rect x="9.1" y="2.5" width="3.4" height="11" rx="1.2" fill="currentColor" />
    </svg>
  );
}

function ClipIcon() {
  return (
    <svg
      className="clip-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.29 7.37l-6.13 6.13a4 4 0 0 1-5.66-5.66l6.13-6.13a2.67 2.67 0 0 1 3.77 3.77l-6.13 6.13a1.33 1.33 0 0 1-1.89-1.89l5.66-5.65" />
    </svg>
  );
}

function BulbIcon() {
  return (
    <svg
      className="bulb-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 1.8a4.4 4.4 0 0 0-2.6 7.95c.55.42.9 1 .95 1.65h3.3c.05-.65.4-1.23.95-1.65A4.4 4.4 0 0 0 8 1.8z" />
      <path d="M6.6 13.6h2.8" />
    </svg>
  );
}

function GaugeIcon() {
  return (
    <svg
      className="gauge-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <path d="M2.5 12a5.5 5.5 0 0 1 11 0" />
      <path d="M8 12l2.6-3.1" />
    </svg>
  );
}

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
  dimmed,
}) {
  const { state, dispatch } = useApp();
  const board = state.boards.find((b) => b.id === boardId);
  const assigneeColor = getMemberColor(board, task.assignee);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  // 'top' | 'bottom' — which side of this card the drop would land on.
  const [dropEdge, setDropEdge] = useState(null);

  useEffect(() => {
    setTitleDraft(task.title);
  }, [task.title]);

  const attachmentCount = task.attachments?.length ?? 0;
  const status = task.status;

  // Click flips active <-> paused without a trip through the modal. Turning
  // the hint off entirely lives in the edit dialog.
  const toggleStatus = (e) => {
    e.stopPropagation();
    dispatch({
      type: 'UPDATE_TASK',
      payload: {
        boardId,
        taskId: task.id,
        updates: {
          status: status === STATUS_ACTIVE ? STATUS_PAUSED : STATUS_ACTIVE,
        },
      },
    });
  };

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
      } ${dimmed ? 'dimmed' : ''}`}
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
        {(status === STATUS_ACTIVE || status === STATUS_PAUSED) && (
          <button
            type="button"
            className={`task-status ${status}`}
            title={
              status === STATUS_ACTIVE
                ? 'Active — click to pause'
                : 'Paused — click to resume'
            }
            onClick={toggleStatus}
          >
            {status === STATUS_ACTIVE ? <PlayIcon /> : <PauseIcon />}
          </button>
        )}
      </div>

      {task.description && (
        <p className="task-description">{task.description}</p>
      )}

      <div className="task-meta">
        {task.isBug && (
          <span className="task-bug" title="Bug">
            <BugIcon />
            Bug
          </span>
        )}
        {task.isFeature && (
          <span className="task-feature" title="Feature idea">
            <BulbIcon />
            Feature
          </span>
        )}
        {task.assignee !== 'Unassigned' && (
          <span className="task-assignee">
            <span
              className="assignee-avatar"
              style={{
                backgroundColor: assigneeColor,
                color: readableTextOn(assigneeColor),
              }}
            >
              {task.assignee.charAt(0)}
            </span>
            {task.assignee}
          </span>
        )}
        <span className="task-score" title={`Score ${getPriority(task)}`}>
          <GaugeIcon />
          {getPriority(task)}
        </span>
        {task.dueDate && (
          <span className={`task-due ${isOverdue ? 'overdue' : ''}`}>
            {formatDate(task.dueDate)}
          </span>
        )}
        {attachmentCount > 0 && (
          <span
            className="task-attachments"
            title={`${attachmentCount} attachment${
              attachmentCount === 1 ? '' : 's'
            }`}
          >
            <ClipIcon />
            {attachmentCount}
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
