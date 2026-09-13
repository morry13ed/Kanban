import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  SORT_OPTIONS,
  sortOptionsForColumn,
  isActiveColumn,
  DEFAULT_SORT,
  DEFAULT_COLUMN_TYPE,
  COLUMN_TYPES,
  isSuccessColumn,
} from '../utils/helpers';
import SegmentedControl from './SegmentedControl';
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
  draggedColumnId,
  onColumnDragStart,
  onColumnDragEnd,
  onColumnDrop,
}) {
  const { dispatch } = useApp();
  const [editing, setEditing] = useState(false);
  const [columnName, setColumnName] = useState(column.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [columnEdge, setColumnEdge] = useState(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortRef = useRef(null);
  const editRef = useRef(null);

  // Read the in-progress name from the outside-click handler without making
  // that effect re-subscribe on every keystroke.
  const draftNameRef = useRef(column.name);
  useEffect(() => {
    draftNameRef.current = columnName;
  }, [columnName]);

  const columnType = column.type || DEFAULT_COLUMN_TYPE;

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
    // The card's own drop handler stops propagation, so this column's
    // onDrop never runs — clear the highlight here instead.
    setDragOver(false);

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

  const handleRename = useCallback(() => {
    const name = draftNameRef.current.trim();
    if (name && name !== column.name) {
      dispatch({
        type: 'RENAME_COLUMN',
        payload: { boardId, columnId: column.id, name },
      });
    } else {
      setColumnName(column.name);
    }
    setEditing(false);
  }, [boardId, column.id, column.name, dispatch]);

  const handleTypeChange = (nextType) => {
    dispatch({
      type: 'SET_COLUMN_TYPE',
      payload: { boardId, columnId: column.id, columnType: nextType },
    });
  };

  // The editor holds a name field and a toggle, so dismissal is scoped to the
  // whole thing. Blurring the input on the way to the toggle must not close it.
  useEffect(() => {
    if (!editing) return;

    const handlePointerDown = (e) => {
      if (editRef.current && !editRef.current.contains(e.target)) {
        handleRename();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setColumnName(column.name);
        setEditing(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editing, handleRename, column.name]);

  const handleDeleteColumn = () => {
    dispatch({
      type: 'DELETE_COLUMN',
      payload: { boardId, columnId: column.id },
    });
    setShowDeleteConfirm(false);
  };

  // A drop onto a card stops propagation so the column's own drop handler
  // can't override the insert position — which also means it never gets to
  // clear this highlight. Dragging always ends in a dragend or a drop
  // somewhere, so watch for either. Also covers a cancelled drag.
  useEffect(() => {
    if (!dragOver) return;

    const clear = () => setDragOver(false);
    document.addEventListener('dragend', clear);
    document.addEventListener('drop', clear);
    return () => {
      document.removeEventListener('dragend', clear);
      document.removeEventListener('drop', clear);
    };
  }, [dragOver]);

  const handleDragOver = (e) => {
    e.preventDefault();
    if (draggedColumnId) {
      if (draggedColumnId === column.id) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setColumnEdge(
        e.clientX < rect.left + rect.width / 2 ? 'left' : 'right'
      );
      return;
    }
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
    setColumnEdge(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (draggedColumnId) {
      const edge = columnEdge;
      setColumnEdge(null);
      onColumnDrop(column.id, edge);
      return;
    }
    setDragOver(false);
    onDrop();
  };

  // The landing indicator only means something mid column-drag.
  const dropEdge =
    draggedColumnId && draggedColumnId !== column.id ? columnEdge : null;

  return (
    <div
      data-column-id={column.id}
      className={`column ${dragOver ? 'drag-over' : ''} ${
        editing ? 'editing' : ''
      } ${dropEdge ? `col-drop-${dropEdge}` : ''} ${
        draggedColumnId === column.id ? 'col-dragging' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {!editing && (
        <div
          className="column-drag-handle"
          draggable
          title="Drag to reorder column"
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/column', column.id);
            onColumnDragStart(column.id);
          }}
          onDragEnd={onColumnDragEnd}
        >
          ⠿
        </div>
      )}
      <div className={`column-header ${editing ? 'editing' : ''}`}>
        {editing ? (
          <div className="column-edit" ref={editRef}>
            <div className="column-edit-name">
              <input
                type="text"
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                }}
                autoFocus
                className="column-name-input"
              />
              <button
                type="button"
                className="column-edit-confirm"
                title="Done"
                onClick={handleRename}
              >
                ✓
              </button>
            </div>
            <SegmentedControl
              small
              options={COLUMN_TYPES}
              value={columnType}
              onChange={handleTypeChange}
            />
          </div>
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
                {sortOptionsForColumn(column).map((option) => (
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
            dimmed={isSuccessColumn(column)}
            inActiveColumn={isActiveColumn(column)}
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
