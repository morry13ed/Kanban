import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { SORT_OPTIONS, DEFAULT_SORT } from '../utils/helpers';
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
  onDropAt,
  onDragEnd,
  draggedTaskId,
}) {
  const { dispatch } = useApp();
  const [editing, setEditing] = useState(false);
  const [columnName, setColumnName] = useState(column.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortRef = useRef(null);

  const sortBy = column.sortBy || DEFAULT_SORT;
  const activeSort = SORT_OPTIONS.find((o) => o.value === sortBy);

  // Dismiss the sort menu on outside click or Escape.
  useEffect(() => {
    if (!showSortMenu) return;

    const handlePointerDown = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setShowSortMenu(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowSortMenu(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSortMenu]);

  // Only meaningful under manual sort — with a sort applied the order is
  // computed, so dropping at a position would have no visible effect.
  const canReorder = sortBy === DEFAULT_SORT;

  const handleDropOnTask = (taskId, edge) => {
    const index = tasks.findIndex((t) => t.id === taskId);
    const beforeTaskId =
      edge === 'top' ? taskId : tasks[index + 1]?.id ?? null;

    // Dropping a task back where it already sits.
    if (taskId === draggedTaskId || beforeTaskId === draggedTaskId) {
      onDragEnd();
      return;
    }

    onDropAt(beforeTaskId);
  };

  const handleSort = (value) => {
    dispatch({
      type: 'SET_COLUMN_SORT',
      payload: { boardId, columnId: column.id, sortBy: value },
    });
    setShowSortMenu(false);
  };

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
            onClick={() => setEditing(true)}
            title="Click to rename column"
          >
            {column.name}
            <span className="column-count">{tasks.length}</span>
          </h3>
        )}
        <div className="column-actions">
          <div className="column-sort" ref={sortRef}>
            <button
              className={`column-action-btn ${
                sortBy !== DEFAULT_SORT ? 'active' : ''
              }`}
              onClick={() => setShowSortMenu((open) => !open)}
              title={
                sortBy === DEFAULT_SORT
                  ? 'Sort tasks'
                  : `Sorted by ${activeSort.label.toLowerCase()}`
              }
            >
              ⇅
            </button>

            {showSortMenu && (
              <div className="column-sort-menu">
                <span className="column-sort-label">Sort by</span>
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={`column-sort-item ${
                      sortBy === option.value ? 'active' : ''
                    }`}
                    onClick={() => handleSort(option.value)}
                  >
                    {option.label}
                    {sortBy === option.value && (
                      <span className="column-sort-check">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

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
            boardId={boardId}
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
            canReorder={canReorder && Boolean(draggedTaskId)}
            onDropOnTask={handleDropOnTask}
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
