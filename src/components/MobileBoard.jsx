import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  sortTasks,
  sortOptionsForColumn,
  isActiveColumn,
  boardColumns,
  subBoardsOf,
  dueHasArrived,
  localToday,
  DEFAULT_SORT,
  DEFAULT_COLUMN_TYPE,
  COLUMN_TYPES,
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
import RescheduleDialog from './RescheduleDialog';
import BoardEditModal from './BoardEditModal';
import SegmentedControl from './SegmentedControl';
import {
  BugIcon,
  PlayIcon,
  PauseIcon,
  ClipIcon,
  BulbIcon,
  GaugeIcon,
  TrashIcon,
} from './icons';
import './MobileBoard.css';

// One column at a time, switched by tabs - the phone replacement for
// dragging between columns. Tasks move through a tap sheet instead.
export default function MobileBoard({ onOpenMenu }) {
  const { state, dispatch } = useApp();

  const [rawColumnId, setRawColumnId] = useState(null);
  const [openMenu, setOpenMenu] = useState(null); // 'filter' | 'sort' | 'more'
  const [movingTaskId, setMovingTaskId] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'column' | 'board'
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState(DEFAULT_COLUMN_TYPE);
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [showEditColumnModal, setShowEditColumnModal] = useState(false);
  const [editColumnName, setEditColumnName] = useState('');
  const [editColumnType, setEditColumnType] = useState(DEFAULT_COLUMN_TYPE);
  const [editColumnView, setEditColumnView] = useState('main'); // 'main' | 'order'
  const [pendingOrder, setPendingOrder] = useState([]); // committed column ids
  const [orderDraft, setOrderDraft] = useState([]); // list being dragged
  const orderListRef = useRef(null);
  const orderDragging = useRef(false);
  const [showBoardModal, setShowBoardModal] = useState(false);
  const [showSubBoardModal, setShowSubBoardModal] = useState(false);
  const [rescheduling, setRescheduling] = useState(null);
  const [newSubBoardName, setNewSubBoardName] = useState('');
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
  // Sub-boards borrow the master's columns; a master's view also shows its
  // sub-boards' tasks, annotated with the board they really live in.
  const columns = boardColumns(board, state.boards);
  const columnsBoardId = board.parentBoardId || board.id;
  const subBoards = subBoardsOf(board, state.boards);
  const allTasks = [
    ...board.tasks.map((t) => ({ ...t, _boardId: board.id })),
    ...subBoards.flatMap((sb) =>
      sb.tasks.map((t) => ({ ...t, _boardId: sb.id, _sub: sb.name }))
    ),
  ];
  const ownerOf = (taskId) =>
    allTasks.find((t) => t.id === taskId)?._boardId ?? board.id;
  const masterBoard =
    state.boards.find((b) => b.id === columnsBoardId) ?? board;
  const masterSubs = state.boards.filter(
    (b) => b.parentBoardId === masterBoard.id
  );
  const boardOptions =
    masterSubs.length > 0
      ? [
          { id: masterBoard.id, name: `${masterBoard.name} · main` },
          ...masterSubs.map((sb) => ({ id: sb.id, name: sb.name })),
        ]
      : [];
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
        allTasks.filter((t) => {
          if (t.archived || t.columnId !== activeColumn.id) return false;
          if (state.filter === 'All') return true;
          return t.assignee === state.filter;
        }),
        activeColumn.sortBy
      )
    : [];

  const celebrateIfSuccess = (taskId, targetColumnId) => {
    const task = allTasks.find((t) => t.id === taskId);
    const target = columns.find((c) => c.id === targetColumnId);
    if (!task || task.columnId === targetColumnId) return;
    if (isSuccessColumn(target)) fireConfetti();
  };

  const moveTask = (taskId, targetColumnId) => {
    // Demoting an auto-activated task asks for a new due date first.
    const task = allTasks.find((t) => t.id === taskId);
    const from = columns.find((c) => c.id === task?.columnId);
    const to = columns.find((c) => c.id === targetColumnId);
    if (
      dueHasArrived(task?.dueDate) &&
      isActiveColumn(from) &&
      to &&
      !isActiveColumn(to) &&
      !isSuccessColumn(to)
    ) {
      setRescheduling({ taskId, targetColumnId });
      setMovingTaskId(null);
      return;
    }
    celebrateIfSuccess(taskId, targetColumnId);
    dispatch({
      type: 'MOVE_TASK',
      payload: { boardId: ownerOf(taskId), taskId, targetColumnId },
    });
    setMovingTaskId(null);
  };

  const finishReschedule = (dueDate) => {
    if (!rescheduling) return;
    const { taskId, targetColumnId } = rescheduling;
    dispatch({
      type: 'UPDATE_TASK',
      payload: {
        boardId: ownerOf(taskId),
        taskId,
        updates: { dueDate, autoActivated: null },
      },
    });
    dispatch({
      type: 'MOVE_TASK',
      payload: { boardId: ownerOf(taskId), taskId, targetColumnId },
    });
    setRescheduling(null);
  };

  const toggleStatus = (task) => {
    dispatch({
      type: 'UPDATE_TASK',
      payload: {
        boardId: task._boardId ?? board.id,
        taskId: task.id,
        updates: {
          status:
            task.status === STATUS_ACTIVE ? STATUS_PAUSED : STATUS_ACTIVE,
        },
      },
    });
  };

  const saveTask = (data, targetBoardId) => {
    if (editingTask) {
      const owner = editingTask._boardId ?? board.id;
      // A column change is a real move (status rules, movedAt, confetti),
      // not a silent field edit.
      const { columnId: newColumnId, ...fields } = data;
      const colChanged = newColumnId && newColumnId !== editingTask.columnId;
      dispatch({
        type: 'UPDATE_TASK',
        payload: { boardId: owner, taskId: editingTask.id, updates: fields },
      });
      const finalBoard =
        targetBoardId && targetBoardId !== owner ? targetBoardId : owner;
      if (finalBoard !== owner) {
        dispatch({
          type: 'TRANSFER_TASK',
          payload: {
            fromBoardId: owner,
            toBoardId: finalBoard,
            taskId: editingTask.id,
          },
        });
      }
      if (colChanged) {
        const from = columns.find((c) => c.id === editingTask.columnId);
        const to = columns.find((c) => c.id === newColumnId);
        const demoting =
          dueHasArrived(editingTask.dueDate) &&
          fields.dueDate === editingTask.dueDate &&
          isActiveColumn(from) &&
          to &&
          !isActiveColumn(to) &&
          !isSuccessColumn(to);
        if (demoting) {
          setRescheduling({ taskId: editingTask.id, targetColumnId: newColumnId });
        } else {
          celebrateIfSuccess(editingTask.id, newColumnId);
          dispatch({
            type: 'MOVE_TASK',
            payload: {
              boardId: finalBoard,
              taskId: editingTask.id,
              targetColumnId: newColumnId,
            },
          });
        }
      }
    } else {
      dispatch({
        type: 'ADD_TASK',
        payload: { boardId: targetBoardId ?? board.id, ...data },
      });
    }
    // Apply the due-date rule right away instead of waiting for the next
    // load: an arrived date in a regular column goes straight to active.
    dispatch({ type: 'AUTO_ACTIVATE_DUE', payload: localToday() });
    setShowTaskModal(false);
    setEditingTask(null);
  };

  const saveColumnEdit = () => {
    if (!activeColumn) return;
    const name = editColumnName.trim() || activeColumn.name;
    dispatch({
      type: 'RENAME_COLUMN',
      payload: { boardId: columnsBoardId, columnId: activeColumn.id, name },
    });
    dispatch({
      type: 'SET_COLUMN_TYPE',
      payload: {
        boardId: columnsBoardId,
        columnId: activeColumn.id,
        columnType: editColumnType,
      },
    });
    if (pendingOrder.join() !== columns.map((c) => c.id).join()) {
      const byId = new Map(columns.map((c) => [c.id, c]));
      dispatch({
        type: 'REORDER_COLUMNS',
        payload: {
          boardId: columnsBoardId,
          columns: pendingOrder.map((id) => byId.get(id)).filter(Boolean),
        },
      });
    }
    setShowEditColumnModal(false);
  };

  const ordinal = (n) =>
    n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;

  const orderLabel = (ids) => {
    if (!activeColumn) return '';
    const pos = ids.indexOf(activeColumn.id);
    if (pos <= 0) return '1st';
    const prev = columns.find((c) => c.id === ids[pos - 1]);
    return `${ordinal(pos + 1)} after ${prev?.name ?? ''}`;
  };

  // One-finger reorder of the edited column inside the order list: only that
  // row is draggable, and it follows the pointer between the other rows.
  const startOrderDrag = (e) => {
    e.preventDefault();
    orderDragging.current = true;
    const move = (ev) => {
      if (!orderDragging.current || !orderListRef.current) return;
      const y = ev.clientY ?? ev.touches?.[0]?.clientY;
      if (y == null) return;
      const rows = [...orderListRef.current.children];
      setOrderDraft((draft) => {
        const from = draft.indexOf(activeColumn.id);
        let to = from;
        rows.forEach((row, idx) => {
          const r = row.getBoundingClientRect();
          if (y > r.top + r.height / 2) to = idx;
        });
        if (y < rows[0]?.getBoundingClientRect().top) to = 0;
        if (to === from) return draft;
        const next = draft.filter((id) => id !== activeColumn.id);
        next.splice(to, 0, activeColumn.id);
        return next;
      });
    };
    const up = () => {
      orderDragging.current = false;
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };

  const addColumn = () => {
    const name = newColumnName.trim();
    if (!name) return;
    dispatch({
      type: 'ADD_COLUMN',
      payload: { boardId: columnsBoardId, name, type: newColumnType },
    });
    setNewColumnName('');
    setNewColumnType(DEFAULT_COLUMN_TYPE);
    setShowColumnModal(false);
  };

  const formatDate = (str) =>
    str
      ? new Date(str).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      : null;

  const movingTask = allTasks.find((t) => t.id === movingTaskId);

  return (
    <div className="mboard">
      {openMenu && <div className="mboard-menu-overlay" />}
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
              onClick={() => {
                setOpenMenu(null);
                setShowColumnModal(true);
              }}
            >
              Add column
            </button>
            {!board.parentBoardId && (
              <button
                type="button"
                className="mboard-menu-item"
                onClick={() => {
                  setOpenMenu(null);
                  setNewSubBoardName('');
                  setShowSubBoardModal(true);
                }}
              >
                Add sub-board
              </button>
            )}
            {!board.parentBoardId && (
              <button
                type="button"
                className="mboard-menu-item"
                onClick={() => {
                  setOpenMenu(null);
                  setShowBoardModal(true);
                }}
              >
                Edit board & sharing
              </button>
            )}
            <div className="mboard-menu-sep" />
            <button
              type="button"
              className="mboard-menu-item danger"
              onClick={() => {
                setOpenMenu(null);
                setConfirm('board');
              }}
            >
              <span className="mboard-menu-item-inner">
                <TrashIcon />
                {board.parentBoardId ? 'Delete sub-board' : 'Delete board'}
              </span>
            </button>
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
              {allTasks.filter(
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
            {sortOptionsForColumn(activeColumn).map((option) => (
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
                      boardId: columnsBoardId,
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
              className="mboard-menu-item"
              onClick={() => {
                setOpenMenu(null);
                if (!activeColumn) return;
                setEditColumnName(activeColumn.name);
                setEditColumnType(activeColumn.type || DEFAULT_COLUMN_TYPE);
                setEditColumnView('main');
                setPendingOrder(columns.map((c) => c.id));
                setOrderDraft(columns.map((c) => c.id));
                setShowEditColumnModal(true);
              }}
            >
              Edit column
            </button>
            <div className="mboard-menu-sep" />
            <button
              type="button"
              className="mboard-menu-item danger"
              onClick={() => {
                setOpenMenu(null);
                setConfirm('column');
              }}
            >
              <span className="mboard-menu-item-inner">
                <TrashIcon />
                Delete column
              </span>
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
                {task._sub && (
                  <span
                    className="task-subchip"
                    style={{
                      backgroundColor: board.color,
                      color: readableTextOn(board.color),
                    }}
                  >
                    {task._sub}
                  </span>
                )}
                <div className="mboard-task-title-row">
                  <span className="mboard-task-title">{task.title}</span>
                  {isActiveColumn(activeColumn) &&
                    (task.status === STATUS_ACTIVE ||
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
              {isActiveColumn(activeColumn) && (
                <div
                  className="task-progress"
                  style={{ width: `${task.completion ?? 0}%` }}
                />
              )}
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
          columns={columns}
          boardOptions={boardOptions}
          currentBoardId={
            editingTask ? (editingTask._boardId ?? board.id) : board.id
          }
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

      {rescheduling && (
        <RescheduleDialog
          initialDate={
            allTasks.find((t) => t.id === rescheduling.taskId)?.dueDate
          }
          onApply={(date) => finishReschedule(date)}
          onRemove={() => finishReschedule('')}
          onCancel={() => setRescheduling(null)}
        />
      )}

      {showSubBoardModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowSubBoardModal(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add sub-board</h3>
              <button
                className="modal-close"
                onClick={() => setShowSubBoardModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-form">
              <div className="form-group">
                <label htmlFor="new-sub-board-name">Sub-board name</label>
                <input
                  id="new-sub-board-name"
                  type="text"
                  value={newSubBoardName}
                  onChange={(e) => setNewSubBoardName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newSubBoardName.trim()) {
                      dispatch({
                        type: 'ADD_SUB_BOARD',
                        payload: { parentId: board.id, name: newSubBoardName },
                      });
                      setShowSubBoardModal(false);
                    }
                    if (e.key === 'Escape') setShowSubBoardModal(false);
                  }}
                  placeholder="Sub-board name..."
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowSubBoardModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (!newSubBoardName.trim()) return;
                    dispatch({
                      type: 'ADD_SUB_BOARD',
                      payload: { parentId: board.id, name: newSubBoardName },
                    });
                    setShowSubBoardModal(false);
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showColumnModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowColumnModal(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add column</h3>
              <button
                className="modal-close"
                onClick={() => setShowColumnModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-form">
              <div className="form-group">
                <label htmlFor="new-column-name">Column name</label>
                <input
                  id="new-column-name"
                  type="text"
                  placeholder="Column name..."
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addColumn();
                    if (e.key === 'Escape') setShowColumnModal(false);
                  }}
                  autoFocus
                />
              </div>
              <div className="form-status">
                <span className="form-status-label">Type</span>
                <SegmentedControl
                  small
                  options={COLUMN_TYPES}
                  value={newColumnType}
                  onChange={setNewColumnType}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowColumnModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={addColumn}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditColumnModal && activeColumn && (
        <div
          className="modal-overlay"
          onClick={() => setShowEditColumnModal(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              {editColumnView === 'order' && (
                <button
                  type="button"
                  className="mcol-back"
                  title="Back"
                  onClick={() => {
                    setOrderDraft(pendingOrder);
                    setEditColumnView('main');
                  }}
                >
                  ←
                </button>
              )}
              <h3>
                {editColumnView === 'order' ? 'Column order' : 'Edit column'}
              </h3>
              <button
                className="modal-close"
                onClick={() => setShowEditColumnModal(false)}
              >
                ×
              </button>
            </div>
            <div className="mcol-panes-clip">
              <div
                className={`mcol-panes ${
                  editColumnView === 'order' ? 'order' : ''
                }`}
              >
                <div className="mcol-pane">
                  <div className="modal-form">
                    <div className="form-group">
                      <label htmlFor="edit-column-name">Column name</label>
                      <input
                        id="edit-column-name"
                        type="text"
                        value={editColumnName}
                        onChange={(e) => setEditColumnName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveColumnEdit();
                          if (e.key === 'Escape')
                            setShowEditColumnModal(false);
                        }}
                        autoFocus
                      />
                    </div>
                    <div className="form-status">
                      <span className="form-status-label">Type</span>
                      <SegmentedControl
                        small
                        options={COLUMN_TYPES}
                        value={editColumnType}
                        onChange={setEditColumnType}
                      />
                    </div>
                    <div className="form-group">
                      <label>Order</label>
                      <button
                        type="button"
                        className="mcol-order-field"
                        onClick={() => {
                          setOrderDraft(pendingOrder);
                          setEditColumnView('order');
                        }}
                      >
                        {orderLabel(pendingOrder)}
                        <span className="mcol-order-chevron">›</span>
                      </button>
                    </div>
                    <div className="modal-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setShowEditColumnModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={saveColumnEdit}
                      >
                        ✓ Ok
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mcol-pane">
                  <div className="modal-form">
                    <ul className="mcol-order-list" ref={orderListRef}>
                      {orderDraft.map((id) => {
                        const col = columns.find((c) => c.id === id);
                        const isEdited = id === activeColumn.id;
                        return (
                          <li
                            key={id}
                            className={`mcol-order-row ${
                              isEdited ? 'edited' : ''
                            }`}
                          >
                            <span className="mcol-order-name">
                              {col?.name}
                            </span>
                            {isEdited && (
                              <span
                                className="mcol-order-grip"
                                onPointerDown={startOrderDrag}
                              >
                                ⠿
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    <div className="modal-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          setPendingOrder(orderDraft);
                          setEditColumnView('main');
                        }}
                      >
                        Save order
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBoardModal && (
        <BoardEditModal board={board} onClose={() => setShowBoardModal(false)} />
      )}

      {confirm === 'column' && activeColumn && (
        <ConfirmDialog
          title="Delete Column"
          message={`Delete "${activeColumn.name}"? All tasks in this column will also be removed.`}
          onConfirm={() => {
            dispatch({
              type: 'DELETE_COLUMN',
              payload: { boardId: columnsBoardId, columnId: activeColumn.id },
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
