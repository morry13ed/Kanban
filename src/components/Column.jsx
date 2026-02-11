import { useState } from 'react';
import { useApp } from '../context/AppContext';
import TaskCard from './TaskCard';
import ConfirmDialog from './ConfirmDialog';
import './Column.css';

export default function Column({
  column,
  tasks,
  boardId,
  isFirst,
  isLast,
  onAddTask,
  onEditTask,
  onMoveTask,
  onCompleteTask,
  onArchiveTask,
  onDeleteTask,
  onDragStart,
  onDrop,
  onDragEnd,
  draggedTaskId,
}) {
  const { dispatch } = useApp();
  const [editing, setEditing] = useState(false);
  const [columnName, setColumnName] = useState(column.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleRename = () => {
    const name = columnName.trim();
    if (name && name !== column.name) {
      dispatch({
        type: 'RENAME_COLUMN',
        payload: { boardId, columnId: column.id, name },
      });
    } else {
      setColumnName(column.name);
    }
    setEditing(false);
  };

  const handleDeleteColumn = () => {
    dispatch({
      type: 'DELETE_COLUMN',
      payload: { boardId, columnId: column.id },
    });
    setShowDeleteConfirm(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    onDrop();
  };

  return (
    <div
      className={`column ${dragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="column-header">
        {editing ? (
          <input
            type="text"
            value={columnName}
            onChange={(e) => setColumnName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') {
                setColumnName(column.name);
                setEditing(false);
              }
            }}
            autoFocus
            className="column-name-input"
          />
        ) : (
          <h3
            className="column-name"
            onDoubleClick={() => setEditing(true)}
            title="Double-click to rename"
          >
            {column.name}
            <span className="column-count">{tasks.length}</span>
          </h3>
        )}
        <div className="column-actions">
          <button
            className="column-action-btn"
            onClick={onAddTask}
            title="Add task"
          >
            +
          </button>
          <button
            className="column-action-btn danger"
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete column"
          >
            ×
          </button>
        </div>
      </div>

      <div className="column-tasks">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            isFirst={isFirst}
            isLast={isLast}
            onEdit={() => onEditTask(task)}
            onMoveLeft={() => onMoveTask(task.id, -1)}
            onMoveRight={() => onMoveTask(task.id, 1)}
            onComplete={() => onCompleteTask(task.id)}
            onArchive={() => onArchiveTask(task.id)}
            onDelete={() => onDeleteTask(task.id)}
            onDragStart={() => onDragStart(task.id)}
            onDragEnd={onDragEnd}
            isDragging={draggedTaskId === task.id}
          />
        ))}
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Column"
          message={`Delete "${column.name}"? All tasks in this column will also be removed.`}
          onConfirm={handleDeleteColumn}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
