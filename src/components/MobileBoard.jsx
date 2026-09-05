import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  sortTasks,
  SORT_OPTIONS,
  DEFAULT_SORT,
  isSuccessColumn,
  getPriority,
  getMemberColor,
  readableTextOn,
  STATUS_ACTIVE,
  STATUS_PAUSED,
} from '../utils/helpers';
import { fireConfetti } from '../utils/confetti';
import TaskModal from './TaskModal';
import ConfirmDialog from './ConfirmDialog';
import {
  BugIcon,
  PlayIcon,
  PauseIcon,
  ClipIcon,
  BulbIcon,
  GaugeIcon,
} from './icons';
import './MobileBoard.css';

// One column at a time, switched by tabs - the phone replacement for
// dragging between columns. Tasks move through a tap sheet instead.
export default function MobileBoard({ onOpenMenu, onEditBoard }) {
  const { state, dispatch } = useApp();

  const [rawColumnId, setRawColumnId] = useState(null);
  const [openMenu, setOpenMenu] = useState(null); // 'filter' | 'sort' | 'more'
  const [movingTaskId, setMovingTaskId] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'column' | 'board'
  const [newColumnName, setNewColumnName] = useState('');
  const menusRef = useRef(null);
  const topbarRef = useRef(null);

  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e) => {
      const inToolbar = menusRef.current?.contains(e.target);
      const inTopbar = topbarRef.current?.contains(e.target);
      if (!inToolbar && !inTopbar) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openMenu]);

  const board = state.boards.find((b) => b.id === state.activeBoardId);

  if (!board) {
    return (
      <div className="mboard">
        <header className="mboard-topbar">
          <button type="button" className="mboard-menu-btn" onClick={onOpenMenu}>
            ☰
          </button>
          <span className="mboard-crumb">Kanban</span>
        </header>
        <div className="mboard-empty">
          <p>No board selected.</p>
          <p>Open the menu to pick or create one.</p>
        </div>
      </div>
    );
  }

  const project = state.projects.find((p) => p.id === board.projectId);
  const columns = board.columns;
  const activeColumn =
    columns.find((c) => c.id === rawColumnId) ?? columns[0] ?? null;

  const memberNames = (board.members || [])
    .map((m) => (typeof m === 'string' ? m : m.name))
    .filter(Boolean);
  const filterOptions = Array.from(
    new Set(['All', ...memberNames, 'Unassigned'])
  );

  const tasks = activeColumn
    ? sortTasks(
        board.tasks.filter((t) => {
          if (t.archived || t.columnId !== activeColumn.id) return false;
          if (state.filter === 'All') return true;
          return t.assignee === state.filter;
        }),
        activeColumn.sortBy
      )
    : [];

  const celebrateIfSuccess = (taskId, targetColumnId) => {
    const task = board.tasks.find((t) => t.id === taskId);
    const target = columns.find((c) => c.id === targetColumnId);
    if (!task || task.columnId === targetColumnId) return;
    if (isSuccessColumn(target)) fireConfetti();
  };

  const moveTask = (taskId, targetColumnId) => {
    celebrateIfSuccess(taskId, targetColumnId);
    dispatch({
      type: 'MOVE_TASK',
      payload: { boardId: board.id, taskId, targetColumnId },
    });
    setMovingTaskId(null);
  };

  const toggleStatus = (task) => {
    dispatch({
      type: 'UPDATE_TASK',
      payload: {
        boardId: board.id,
        taskId: task.id,
        updates: {
          status:
            task.status === STATUS_ACTIVE ? STATUS_PAUSED : STATUS_ACTIVE,
        },
      },
    });
  };

  const saveTask = (data) => {
    dispatch(
      editingTask
        ? {
            type: 'UPDATE_TASK',
            payload: { boardId: board.id, taskId: editingTask.id, updates: data },
          }
        : { type: 'ADD_TASK', payload: { boardId: board.id, ...data } }
    );
    setShowTaskModal(false);
    setEditingTask(null);
  };

  const addColumn = () => {
    const name = newColumnName.trim();
    if (!name) return;
    dispatch({ type: 'ADD_COLUMN', payload: { boardId: board.id, name } });
    setNewColumnName('');
    setOpenMenu(null);
  };

  const formatDate = (str) =>
    str
      ? new Date(str).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      : null;

  const movingTask = board.tasks.find((t) => t.id === movingTaskId);

  return (
    <div className="mboard">
      <header className="mboard-topbar" ref={topbarRef}>
        <button type="button" className="mboard-menu-btn" onClick={onOpenMenu}>
          ☰
        </button>
        <span className="mboard-crumb">
          {project ? `${project.name} / ` : ''}
          <strong>{board.name}</strong>
        </span>
        <button
          type="button"
          className="mboard-menu-btn mboard-addcol-btn"
          title="Board options"
          onClick={() => setOpenMenu(openMenu === 'top' ? null : 'top')}
        >
          ⋮
        </button>

        {openMenu === 'top' && (
          <div className="mboard-menu mboard-addcol-menu">
            <button
              type="button"
              className="mboard-menu-item"
              onClick={() => setOpenMenu('addcol')}
            >
              Add column
            </button>
            <button
              type="button"
              className="mboard-menu-item"
              onClick={() => {
                setOpenMenu(null);
                onEditBoard?.(board.id);
              }}
            >
              Edit board & sharing
            </button>
            <div className="mboard-menu-sep" />
            <button
              type="button"
              className="mboard-menu-item danger"
              onClick={() => {
                setOpenMenu(null);
                setConfirm('board');
              }}
            >
              Delete board
            </button>
          </div>
        )}

        {openMenu === 'addcol' && (
          <div className="mboard-menu mboard-addcol-menu">
            <div className="mboard-addcol">
              <input
                type="text"
                placeholder="Column name..."
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addColumn();
                  if (e.key === 'Escape') setOpenMenu(null);
                }}
                autoFocus
              />
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={addColumn}
              >
                Add
              </button>
            </div>
          </div>
        )}
      </header>

      <div className="mboard-tabs">
        {columns.map((column) => (
          <button
            key={column.id}
            type="button"
            className={`mboard-tab ${
              column.id === activeColumn?.id ? 'active' : ''
            }`}
            onClick={() => setRawColumnId(column.id)}
          >
            {column.name}
            <span className="mboard-tab-count">
              {board.tasks.filter(
                (t) => !t.archived && t.columnId === column.id
              ).length}
            </span>
          </button>
        ))}
      </div>

      <div className="mboard-toolbar" ref={menusRef}>
        <button
          type="button"
          className="mboard-filter"
          onClick={() => setOpenMenu(openMenu === 'filter' ? null : 'filter')}
        >
          Assigned to: <strong>{state.filter}</strong> ▾
        </button>
        <div className="mboard-toolbar-actions">
          <button
            type="button"
            className="mboard-tool-btn"
            title="Sort"
            onClick={() => setOpenMenu(openMenu === 'sort' ? null : 'sort')}
          >
            ⇅
          </button>
          <button
            type="button"
            className="mboard-tool-btn"
            title="More"
            onClick={() => setOpenMenu(openMenu === 'more' ? null : 'more')}
          >
            ⋮
          </button>
        </div>

        {openMenu === 'filter' && (
          <div className="mboard-menu">
            {filterOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={`mboard-menu-item ${
                  state.filter === option ? 'active' : ''
                }`}
                onClick={() => {
                  dispatch({ type: 'SET_FILTER', payload: option });
                  setOpenMenu(null);
                }}
              >
                {option}
                {state.filter === option && <span>✓</span>}
              </button>
            ))}
          </div>
        )}

        {openMenu === 'sort' && activeColumn && (
          <div className="mboard-menu">
            <span className="mboard-menu-label">Sort by</span>
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`mboard-menu-item ${
                  (activeColumn.sortBy || DEFAULT_SORT) === option.value
                    ? 'active'
                    : ''
                }`}
                onClick={() => {
                  dispatch({
                    type: 'SET_COLUMN_SORT',
                    payload: {
                      boardId: board.id,
                      columnId: activeColumn.id,
                      sortBy: option.value,
                    },
                  });
                  setOpenMenu(null);
                }}
              >
                {option.label}
                {(activeColumn.sortBy || DEFAULT_SORT) === option.value && (
                  <span>✓</span>
                )}
              </button>
            ))}
          </div>
        )}

        {openMenu === 'more' && (
          <div className="mboard-menu">
            <button
              type="button"
              className="mboard-menu-item danger"
              onClick={() => {
                setOpenMenu(null);
                setConfirm('column');
              }}
            >
              Delete column
            </button>
          </div>
        )}
      </div>

      <ul className="mboard-tasks">
        {tasks.map((task) => {
          const overdue =
            task.dueDate &&
            new Date(task.dueDate) < new Date() &&
            !task.archived;
          const assigneeColor = getMemberColor(board, task.assignee);
          const dimmed = isSuccessColumn(activeColumn);

          return (
            <li
              key={task.id}
              className={`mboard-task ${dimmed ? 'dimmed' : ''}`}
            >
              <button
                type="button"
                className="mboard-move"
                title="Move to another column"
                onClick={() => setMovingTaskId(task.id)}
              />
              <div
                className="mboard-task-body"
                onClick={() => {
                  setEditingTask(task);
                  setShowTaskModal(true);
                }}
              >
                <div className="mboard-task-title-row">
                  <span className="mboard-task-title">{task.title}</span>
                  {(task.status === STATUS_ACTIVE ||
                    task.status === STATUS_PAUSED) && (
                    <button
                      type="button"
                      className={`task-status ${task.status}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStatus(task);
                      }}
                    >
                      {task.status === STATUS_ACTIVE ? (
                        <PlayIcon />
                      ) : (
                        <PauseIcon />
                      )}
                    </button>
                  )}
                </div>
                <div className="mboard-task-meta">
                  {task.assignee !== 'Unassigned' && (
                    <span
                      className="assignee-avatar"
                      style={{
                        backgroundColor: assigneeColor,
                        color: readableTextOn(assigneeColor),
                      }}
                    >
                      {task.assignee.charAt(0)}
                    </span>
                  )}
                  {task.isBug && (
                    <span className="task-bug">
                      <BugIcon />
                      Bug
                    </span>
                  )}
                  {task.isFeature && (
                    <span className="task-feature">
                      <BulbIcon />
                      Feature
                    </span>
                  )}
                  <span className="task-score" title={`Score ${getPriority(task)}`}>
                    <GaugeIcon />
                    {getPriority(task)}
                  </span>
                  {task.dueDate && (
                    <span className={`task-due ${overdue ? 'overdue' : ''}`}>
                      {formatDate(task.dueDate)}
                    </span>
                  )}
                  {(task.attachments?.length ?? 0) > 0 && (
                    <span className="task-attachments">
                      <ClipIcon />
                      {task.attachments.length}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
        {tasks.length === 0 && (
          <li className="mboard-no-tasks">No tasks here.</li>
        )}
      </ul>

      <button
        type="button"
        className="mboard-fab"
        title="Add task"
        onClick={() => {
          setEditingTask(null);
          setShowTaskModal(true);
        }}
      >
        +
      </button>

      {movingTask && (
        <div className="mboard-sheet-overlay" onClick={() => setMovingTaskId(null)}>
          <div className="mboard-sheet" onClick={(e) => e.stopPropagation()}>
            <span className="mboard-sheet-title">
              Move “{movingTask.title}” to
            </span>
            {columns
              .filter((c) => c.id !== movingTask.columnId)
              .map((column) => (
                <button
                  key={column.id}
                  type="button"
                  className="mboard-sheet-item"
                  onClick={() => moveTask(movingTask.id, column.id)}
                >
                  {column.name}
                </button>
              ))}
            <button
              type="button"
              className="mboard-sheet-cancel"
              onClick={() => setMovingTaskId(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showTaskModal && activeColumn && (
        <TaskModal
          task={editingTask}
          defaultColumnId={activeColumn.id}
          members={memberNames}
          memberColorOf={(name) => getMemberColor(board, name)}
          onSave={saveTask}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
        />
      )}

      {confirm === 'column' && activeColumn && (
        <ConfirmDialog
          title="Delete Column"
          message={`Delete "${activeColumn.name}"? All tasks in this column will also be removed.`}
          onConfirm={() => {
            dispatch({
              type: 'DELETE_COLUMN',
              payload: { boardId: board.id, columnId: activeColumn.id },
            });
            setConfirm(null);
            setRawColumnId(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm === 'board' && (
        <ConfirmDialog
          title="Delete Board"
          message={`Are you sure you want to delete "${board.name}"? This will remove all tasks and columns.`}
          onConfirm={() => {
            dispatch({ type: 'DELETE_BOARD', payload: board.id });
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

    </div>
  );
}
