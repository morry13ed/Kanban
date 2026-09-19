import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  sortTasks,
  getMemberColor,
  DEFAULT_SORT,
  DEFAULT_COLUMN_TYPE,
  COLUMN_TYPES,
  isSuccessColumn,
  doneColumnOf,
  boardColumns,
  subBoardsOf,
} from '../utils/helpers';
import { fireConfetti } from '../utils/confetti';
import Column from './Column';
import SegmentedControl from './SegmentedControl';
import TaskModal from './TaskModal';
import ConfirmDialog from './ConfirmDialog';
import './Board.css';

export default function Board() {
  const { state, dispatch } = useApp();
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [defaultColumnId, setDefaultColumnId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState(DEFAULT_COLUMN_TYPE);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [showSubBoardForm, setShowSubBoardForm] = useState(false);
  const [newSubBoardName, setNewSubBoardName] = useState('');
  const [draggedColumnId, setDraggedColumnId] = useState(null);
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);
  const boardMenuRef = useRef(null);

  useEffect(() => {
    if (!boardMenuOpen) return;
    const onPointerDown = (e) => {
      if (boardMenuRef.current && !boardMenuRef.current.contains(e.target)) {
        setBoardMenuOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setBoardMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [boardMenuOpen]);

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

  // Sub-boards borrow the master's columns; a master's view also shows its
  // sub-boards' tasks, each annotated with the board it really lives in.
  const columns = boardColumns(board, state.boards);
  const subBoards = subBoardsOf(board, state.boards);
  const allTasks = [
    ...board.tasks.map((t) => ({ ...t, _boardId: board.id })),
    ...subBoards.flatMap((sb) =>
      sb.tasks.map((t) => ({ ...t, _boardId: sb.id, _sub: sb.name }))
    ),
  ];
  const ownerOf = (taskId) =>
    allTasks.find((t) => t.id === taskId)?._boardId ?? board.id;
  // Column-level edits always land on the board that owns the columns.
  const columnsBoardId = board.parentBoardId || board.id;

  const inferredMembers = Array.from(
    new Set(
      allTasks
        .map((t) => t.assignee)
        .filter((a) => a && a !== 'Unassigned')
    )
  );

  const memberNamesFromBoard = (board.members || [])
    .map((m) => (typeof m === 'string' ? m : m.name))
    .filter(Boolean);

  const boardMembers =
    memberNamesFromBoard.length > 0 ? memberNamesFromBoard : inferredMembers;

  const filteredTasks = allTasks.filter((t) => {
    if (t.archived) return false;
    if (state.filter === 'All') return true;
    return t.assignee === state.filter;
  });

  const filterOptions = Array.from(
    new Set(['All', ...boardMembers, 'Unassigned'])
  );

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
          boardId: editingTask._boardId ?? board.id,
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
      payload: { boardId: columnsBoardId, name, type: newColumnType },
    });
    setNewColumnName('');
    setNewColumnType(DEFAULT_COLUMN_TYPE);
    setAddingColumn(false);
  };

  // Fires only on an actual transfer into a success column, so nudging a task
  // around inside one stays quiet.
  const celebrateIfSuccess = (taskId, targetColumnId) => {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task || task.columnId === targetColumnId) return;

    const target = columns.find((c) => c.id === targetColumnId);
    if (!isSuccessColumn(target)) return;

    const el = document.querySelector(`[data-column-id="${targetColumnId}"]`);
    const rect = el?.getBoundingClientRect();
    fireConfetti(
      rect ? { x: rect.left + rect.width / 2, y: rect.top + 60 } : undefined
    );
  };

  const handleMoveTask = (taskId, direction) => {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;
    const colIndex = columns.findIndex((c) => c.id === task.columnId);
    const targetIndex = colIndex + direction;
    if (targetIndex < 0 || targetIndex >= columns.length) return;

    celebrateIfSuccess(taskId, columns[targetIndex].id);
    dispatch({
      type: 'MOVE_TASK',
      payload: {
        boardId: task._boardId,
        taskId,
        targetColumnId: columns[targetIndex].id,
      },
    });
  };

  const handleCompleteTask = (taskId) => {
    const doneColumn = doneColumnOf(board, state.boards);
    if (!doneColumn) return;

    celebrateIfSuccess(taskId, doneColumn.id);
    dispatch({
      type: 'MOVE_TASK',
      payload: {
        boardId: ownerOf(taskId),
        taskId,
        targetColumnId: doneColumn.id,
      },
    });
  };

  const handleArchiveTask = (taskId) => {
    dispatch({
      type: 'ARCHIVE_TASK',
      payload: { boardId: ownerOf(taskId), taskId },
    });
  };

  const handleDeleteTask = (taskId) => {
    dispatch({
      type: 'DELETE_TASK',
      payload: { boardId: ownerOf(taskId), taskId },
    });
  };

  const handleDragStart = (taskId) => {
    setDraggedTaskId(taskId);
  };

  // beforeTaskId === null means "put it at the end".
  const handleDropAt = (columnId, beforeTaskId) => {
    if (!draggedTaskId) return;

    const dragged = allTasks.find((t) => t.id === draggedTaskId);
    const column = columns.find((c) => c.id === columnId);
    const isSorted = column && (column.sortBy || DEFAULT_SORT) !== DEFAULT_SORT;

    // Rearranging inside a sorted column can't change what you see, so don't
    // quietly shuffle the manual order sitting underneath it.
    if (isSorted && dragged?.columnId === columnId) {
      setDraggedTaskId(null);
      return;
    }

    // Manual order lives per board, so "before" only means something between
    // tasks of the same board; across boards it falls back to a plain move.
    const anchorOk =
      beforeTaskId && ownerOf(beforeTaskId) === dragged?._boardId;

    celebrateIfSuccess(draggedTaskId, columnId);
    dispatch({
      type: 'REORDER_TASK',
      payload: {
        boardId: dragged?._boardId ?? board.id,
        taskId: draggedTaskId,
        targetColumnId: columnId,
        beforeTaskId: anchorOk ? beforeTaskId : null,
      },
    });
    setDraggedTaskId(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
  };

  // Reorder columns: drop the dragged column on the left or right side of
  // the target.
  const handleColumnDrop = (targetId, edge) => {
    const sourceId = draggedColumnId;
    setDraggedColumnId(null);
    if (!sourceId || sourceId === targetId || !edge) return;
    const next = [...columns];
    const from = next.findIndex((c) => c.id === sourceId);
    if (from === -1) return;
    const [moved] = next.splice(from, 1);
    let to = next.findIndex((c) => c.id === targetId);
    if (to === -1) return;
    if (edge === 'right') to += 1;
    next.splice(to, 0, moved);
    dispatch({
      type: 'REORDER_COLUMNS',
      payload: { boardId: columnsBoardId, columns: next },
    });
  };

  const handleAddSubBoard = () => {
    const name = newSubBoardName.trim();
    if (!name) return;
    dispatch({
      type: 'ADD_SUB_BOARD',
      payload: { parentId: board.id, name },
    });
    setNewSubBoardName('');
    setShowSubBoardForm(false);
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
            {filterOptions.map((opt) => (
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
          <div className="board-menu-wrap" ref={boardMenuRef}>
            <button
              type="button"
              className="board-menu-btn"
              title="Board options"
              onClick={() => setBoardMenuOpen((open) => !open)}
            >
              ⋯
            </button>
            {boardMenuOpen && (
              <div className="board-menu">
                {!board.parentBoardId && (
                  <>
                    <button
                      type="button"
                      className="board-menu-item"
                      onClick={() => {
                        setBoardMenuOpen(false);
                        setNewSubBoardName('');
                        setShowSubBoardForm(true);
                      }}
                    >
                      Add sub-board
                    </button>
                    <div className="board-menu-sep" />
                  </>
                )}
                <button
                  type="button"
                  className="board-menu-item danger"
                  onClick={() => {
                    setBoardMenuOpen(false);
                    setShowDeleteConfirm(true);
                  }}
                >
                  {board.parentBoardId ? 'Delete sub-board' : 'Delete board'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="board-columns">
        {columns.map((column, index) => (
          <Column
            key={column.id}
            column={column}
            tasks={sortTasks(
              filteredTasks.filter((t) => t.columnId === column.id),
              column.sortBy
            )}
            boardId={columnsBoardId}
            isFirst={index === 0}
            isLast={index === columns.length - 1}
            isDone={column.id === doneColumnOf(board, state.boards)?.id}
            onAddTask={() => handleAddTask(column.id)}
            onEditTask={handleEditTask}
            onMoveTask={handleMoveTask}
            onCompleteTask={handleCompleteTask}
            onArchiveTask={handleArchiveTask}
            onDeleteTask={handleDeleteTask}
            onDragStart={handleDragStart}
            onDrop={() => handleDropAt(column.id, null)}
            onDropAt={(beforeTaskId) => handleDropAt(column.id, beforeTaskId)}
            onDragEnd={handleDragEnd}
            draggedTaskId={draggedTaskId}
            draggedColumnId={draggedColumnId}
            onColumnDragStart={setDraggedColumnId}
            onColumnDragEnd={() => setDraggedColumnId(null)}
            onColumnDrop={handleColumnDrop}
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
              <div className="add-column-footer">
                <SegmentedControl
                  small
                  options={COLUMN_TYPES}
                  value={newColumnType}
                  onChange={setNewColumnType}
                />
                <div className="add-column-actions">
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setAddingColumn(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={handleAddColumn}
                  >
                    Add
                  </button>
                </div>
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
          columns={columns}
          memberColorOf={(name) => getMemberColor(board, name)}
          members={boardMembers}
          defaultColumnId={defaultColumnId || columns[0]?.id}
          onSave={handleSaveTask}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title={board.parentBoardId ? 'Delete sub-board' : 'Delete Board'}
          message={
            board.parentBoardId
              ? `Are you sure you want to delete "${board.name}"? This will remove its tasks. The master board is not affected.`
              : subBoards.length > 0
                ? `Are you sure you want to delete "${board.name}"? This will remove all tasks and columns, including its ${subBoards.length} sub-board${subBoards.length !== 1 ? 's' : ''}.`
                : `Are you sure you want to delete "${board.name}"? This will remove all tasks and columns.`
          }
          onConfirm={handleDeleteBoard}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {showSubBoardForm && (
        <div
          className="modal-overlay"
          onClick={() => setShowSubBoardForm(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add sub-board</h3>
              <button
                className="modal-close"
                onClick={() => setShowSubBoardForm(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-form">
              <div className="form-group">
                <label htmlFor="sub-board-name">Sub-board name</label>
                <input
                  id="sub-board-name"
                  type="text"
                  value={newSubBoardName}
                  onChange={(e) => setNewSubBoardName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddSubBoard();
                    if (e.key === 'Escape') setShowSubBoardForm(false);
                  }}
                  placeholder="Sub-board name..."
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowSubBoardForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAddSubBoard}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
