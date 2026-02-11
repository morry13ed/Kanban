import { useState } from 'react';
import { useApp } from '../context/AppContext';
import Column from './Column';
import TaskModal from './TaskModal';
import ConfirmDialog from './ConfirmDialog';
import { FILTER_OPTIONS } from '../utils/helpers';
import './Board.css';

export default function Board() {
  const { state, dispatch } = useApp();
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [defaultColumnId, setDefaultColumnId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState(null);

  const board = state.boards.find((b) => b.id === state.activeBoardId);

  if (!board) {
    return (
      <div className="board-empty">
        <div className="empty-state">
          <h2>No project selected</h2>
          <p>Create a project from the sidebar to get started.</p>
        </div>
      </div>
    );
  }

  const filteredTasks = board.tasks.filter((t) => {
    if (t.archived) return false;
    if (state.filter === 'All') return true;
    return t.assignee === state.filter;
  });

  const handleAddTask = (columnId) => {
    setEditingTask(null);
    setDefaultColumnId(columnId);
    setShowTaskModal(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setDefaultColumnId(null);
    setShowTaskModal(true);
  };

  const handleSaveTask = (taskData) => {
    if (editingTask) {
      dispatch({
        type: 'UPDATE_TASK',
        payload: {
          boardId: board.id,
          taskId: editingTask.id,
          updates: taskData,
        },
      });
    } else {
      dispatch({
        type: 'ADD_TASK',
        payload: { boardId: board.id, ...taskData },
      });
    }
    setShowTaskModal(false);
    setEditingTask(null);
  };

  const handleDeleteBoard = () => {
    dispatch({ type: 'DELETE_BOARD', payload: board.id });
    setShowDeleteConfirm(false);
  };

  const handleAddColumn = () => {
    const name = newColumnName.trim();
    if (!name) return;
    dispatch({
      type: 'ADD_COLUMN',
      payload: { boardId: board.id, name },
    });
    setNewColumnName('');
    setAddingColumn(false);
  };

  const handleMoveTask = (taskId, direction) => {
    const task = board.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const colIndex = board.columns.findIndex((c) => c.id === task.columnId);
    const targetIndex = colIndex + direction;
    if (targetIndex < 0 || targetIndex >= board.columns.length) return;
    dispatch({
      type: 'MOVE_TASK',
      payload: {
        boardId: board.id,
        taskId,
        targetColumnId: board.columns[targetIndex].id,
      },
    });
  };

  const handleCompleteTask = (taskId) => {
    const lastColumn = board.columns[board.columns.length - 1];
    if (!lastColumn) return;
    dispatch({
      type: 'MOVE_TASK',
      payload: {
        boardId: board.id,
        taskId,
        targetColumnId: lastColumn.id,
      },
    });
  };

  const handleArchiveTask = (taskId) => {
    dispatch({
      type: 'ARCHIVE_TASK',
      payload: { boardId: board.id, taskId },
    });
  };

  const handleDeleteTask = (taskId) => {
    dispatch({
      type: 'DELETE_TASK',
      payload: { boardId: board.id, taskId },
    });
  };

  const handleDragStart = (taskId) => {
    setDraggedTaskId(taskId);
  };

  const handleDrop = (columnId) => {
    if (!draggedTaskId) return;
    dispatch({
      type: 'MOVE_TASK',
      payload: {
        boardId: board.id,
        taskId: draggedTaskId,
        targetColumnId: columnId,
      },
    });
    setDraggedTaskId(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
  };

  return (
    <div className="board">
      <div className="board-header">
        <div className="board-header-left">
          <span
            className="board-header-dot"
            style={{ backgroundColor: board.color }}
          />
          <h2 className="board-title">{board.name}</h2>
          <span className="board-task-count">
            {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="board-header-right">
          <div className="filter-bar">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt}
                className={`filter-btn ${state.filter === opt ? 'active' : ''}`}
                onClick={() =>
                  dispatch({ type: 'SET_FILTER', payload: opt })
                }
              >
                {opt}
              </button>
            ))}
          </div>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete Board
          </button>
        </div>
      </div>

      <div className="board-columns">
        {board.columns.map((column, index) => (
          <Column
            key={column.id}
            column={column}
            tasks={filteredTasks.filter((t) => t.columnId === column.id)}
            boardId={board.id}
            isFirst={index === 0}
            isLast={index === board.columns.length - 1}
            onAddTask={() => handleAddTask(column.id)}
            onEditTask={handleEditTask}
            onMoveTask={handleMoveTask}
            onCompleteTask={handleCompleteTask}
            onArchiveTask={handleArchiveTask}
            onDeleteTask={handleDeleteTask}
            onDragStart={handleDragStart}
            onDrop={() => handleDrop(column.id)}
            onDragEnd={handleDragEnd}
            draggedTaskId={draggedTaskId}
          />
        ))}

        <div className="add-column">
          {addingColumn ? (
            <div className="add-column-form">
              <input
                type="text"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddColumn();
                  if (e.key === 'Escape') setAddingColumn(false);
                }}
                placeholder="Column name..."
                autoFocus
                className="add-column-input"
              />
              <div className="add-column-actions">
                <button className="btn btn-sm btn-primary" onClick={handleAddColumn}>
                  Add
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => setAddingColumn(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="add-column-btn"
              onClick={() => setAddingColumn(true)}
            >
              + Add Column
            </button>
          )}
        </div>
      </div>

      {showTaskModal && (
        <TaskModal
          task={editingTask}
          columns={board.columns}
          defaultColumnId={defaultColumnId || board.columns[0]?.id}
          onSave={handleSaveTask}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Board"
          message={`Are you sure you want to delete "${board.name}"? This will remove all tasks and columns.`}
          onConfirm={handleDeleteBoard}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
