import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useState,
  useRef,
} from 'react';
import { loadState, saveState } from '../utils/storage';
import {
  isRemoteEnabled,
  fetchWorkspace,
  pushBoard,
  deleteBoardRemote,
  pushUserState,
  reconcileMembers,
  subscribeBoards,
} from '../utils/sync';
import { useAuth } from './AuthContext';
import {
  createBoard,
  createTask,
  generateId,
  DEFAULT_SORT,
  DEFAULT_COLUMN_TYPE,
  STATUS_NONE,
  STATUS_ACTIVE,
  isSuccessColumn,
  isActiveColumn,
  normalizeState,
} from '../utils/helpers';

const AppContext = createContext();

const REMOTE_SAVE_DELAY = 800;

// 'off'    — no Supabase credentials, this browser only
// 'saving' — a write is in flight
// 'synced' — last read/write succeeded
// 'error'  — last read/write failed (paused project, network, bad policy)
const SYNC_OFF = 'off';

const defaultState = {
  projects: [],
  groups: [],
  boards: [],
  activeBoardId: null,
  theme: 'dark',
  filter: 'All',
};

// Status side effects of a task changing column. Landing in an active column
// marks it active; landing in a success column, or leaving an active column
// for a regular one, turns the status off. A move between regular columns
// leaves a manually set status alone.
function statusOnTransfer(sourceColumn, targetColumn) {
  if (isActiveColumn(targetColumn)) return { status: STATUS_ACTIVE };
  if (isSuccessColumn(targetColumn) || isActiveColumn(sourceColumn)) {
    return { status: STATUS_NONE };
  }
  return {};
}

function reducer(state, action) {
  switch (action.type) {
    // ── Theme ──
    case 'TOGGLE_THEME':
      return { ...state, theme: state.theme === 'dark' ? 'light' : 'dark' };

    // ── Filter ──
    case 'SET_FILTER':
      return { ...state, filter: action.payload };

    // ── Projects & groups ──
    case 'ADD_PROJECT': {
      const name = action.payload.trim();
      if (!name) return state;
      if (state.projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        return state;
      }
      return {
        ...state,
        projects: [...state.projects, { id: generateId(), name }],
      };
    }
    case 'UPDATE_PROJECT': {
      const name = action.payload.name.trim();
      if (!name) return state;
      return {
        ...state,
        projects: state.projects.map((pr) =>
          pr.id === action.payload.id ? { ...pr, name } : pr
        ),
      };
    }
    case 'DELETE_PROJECT': {
      const id = action.payload;
      const boards = state.boards.filter((b) => b.projectId !== id);
      const stillActive = boards.some((b) => b.id === state.activeBoardId);
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== id),
        groups: state.groups.filter((g) => g.projectId !== id),
        boards,
        activeBoardId: stillActive
          ? state.activeBoardId
          : (boards[0]?.id ?? null),
      };
    }
    case 'ADD_GROUP': {
      const { projectId } = action.payload;
      const name = action.payload.name.trim();
      if (!name) return state;
      const duplicate = state.groups.some(
        (g) =>
          g.projectId === projectId &&
          g.name.toLowerCase() === name.toLowerCase()
      );
      if (duplicate) return state;
      return {
        ...state,
        groups: [...state.groups, { id: generateId(), name, projectId }],
      };
    }

    // ── Boards ──
    case 'ADD_BOARD': {
      const board = {
        ...createBoard(
          action.payload.name,
          action.payload.color,
          action.payload.members
        ),
        projectId: action.payload.projectId,
        groupId: action.payload.groupId ?? null,
      };
      return {
        ...state,
        boards: [...state.boards, board],
        activeBoardId: board.id,
      };
    }
    case 'DELETE_BOARD': {
      const boards = state.boards.filter((b) => b.id !== action.payload);
      return {
        ...state,
        boards,
        activeBoardId: boards.length > 0 ? boards[0].id : null,
      };
    }
    case 'SET_ACTIVE_BOARD':
      return { ...state, activeBoardId: action.payload, filter: 'All' };

    // Colour for one board member, creating the member entry if the name only
    // existed as a task assignee so far.
    case 'SET_MEMBER_COLOR': {
      const { boardId, name, color } = action.payload;
      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== boardId) return b;
          const members = (b.members || []).map((m) =>
            typeof m === 'string' ? { name: m, email: '' } : m
          );
          const exists = members.some((m) => m.name === name);
          return {
            ...b,
            members: exists
              ? members.map((m) => (m.name === name ? { ...m, color } : m))
              : [...members, { name, email: '', color }],
          };
        }),
      };
    }
    case 'UPDATE_BOARD': {
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.payload.id ? { ...b, ...action.payload.updates } : b
        ),
      };
    }

    // ── Columns ──
    case 'ADD_COLUMN': {
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.payload.boardId
            ? {
                ...b,
                columns: [
                  ...b.columns,
                  {
                    id: generateId(),
                    name: action.payload.name,
                    sortBy: DEFAULT_SORT,
                    type: action.payload.type || DEFAULT_COLUMN_TYPE,
                  },
                ],
              }
            : b
        ),
      };
    }
    case 'RENAME_COLUMN': {
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.payload.boardId
            ? {
                ...b,
                columns: b.columns.map((c) =>
                  c.id === action.payload.columnId
                    ? { ...c, name: action.payload.name }
                    : c
                ),
              }
            : b
        ),
      };
    }
    case 'DELETE_COLUMN': {
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.payload.boardId
            ? {
                ...b,
                columns: b.columns.filter(
                  (c) => c.id !== action.payload.columnId
                ),
                tasks: b.tasks.filter(
                  (t) => t.columnId !== action.payload.columnId
                ),
              }
            : b
        ),
      };
    }
    case 'SET_COLUMN_TYPE': {
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.payload.boardId
            ? {
                ...b,
                columns: b.columns.map((c) =>
                  c.id === action.payload.columnId
                    ? { ...c, type: action.payload.columnType }
                    : c
                ),
              }
            : b
        ),
      };
    }
    case 'SET_COLUMN_SORT': {
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.payload.boardId
            ? {
                ...b,
                columns: b.columns.map((c) =>
                  c.id === action.payload.columnId
                    ? { ...c, sortBy: action.payload.sortBy }
                    : c
                ),
              }
            : b
        ),
      };
    }
    case 'REORDER_COLUMNS': {
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.payload.boardId
            ? { ...b, columns: action.payload.columns }
            : b
        ),
      };
    }

    // ── Tasks ──
    case 'ADD_TASK': {
      const { boardId } = action.payload;
      const task = createTask(action.payload);
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === boardId ? { ...b, tasks: [...b.tasks, task] } : b
        ),
      };
    }
    case 'UPDATE_TASK': {
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.payload.boardId
            ? {
                ...b,
                tasks: b.tasks.map((t) =>
                  t.id === action.payload.taskId
                    ? { ...t, ...action.payload.updates }
                    : t
                ),
              }
            : b
        ),
      };
    }
    case 'DELETE_TASK': {
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.payload.boardId
            ? {
                ...b,
                tasks: b.tasks.filter((t) => t.id !== action.payload.taskId),
              }
            : b
        ),
      };
    }
    case 'MOVE_TASK': {
      const { boardId, taskId, targetColumnId } = action.payload;
      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== boardId) return b;
          const target = b.columns.find((c) => c.id === targetColumnId);
          return {
            ...b,
            tasks: b.tasks.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    columnId: targetColumnId,
                    ...(t.columnId !== targetColumnId
                      ? {
                          movedAt: new Date().toISOString(),
                          ...statusOnTransfer(
                            b.columns.find((c) => c.id === t.columnId),
                            target
                          ),
                        }
                      : {}),
                  }
                : t
            ),
          };
        }),
      };
    }
    // Moves a task to targetColumnId and places it directly before
    // beforeTaskId, or at the end of the board's task list when that is null.
    // Order within a column is just the order of board.tasks.
    case 'REORDER_TASK': {
      const { boardId, taskId, targetColumnId, beforeTaskId } = action.payload;

      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== boardId) return b;

          const moving = b.tasks.find((t) => t.id === taskId);
          if (!moving) return b;

          const rest = b.tasks.filter((t) => t.id !== taskId);
          const moved = {
            ...moving,
            columnId: targetColumnId,
            ...(moving.columnId !== targetColumnId
              ? {
                  movedAt: new Date().toISOString(),
                  ...statusOnTransfer(
                    b.columns.find((c) => c.id === moving.columnId),
                    b.columns.find((c) => c.id === targetColumnId)
                  ),
                }
              : {}),
          };
          const at = beforeTaskId
            ? rest.findIndex((t) => t.id === beforeTaskId)
            : -1;

          if (at === -1) rest.push(moved);
          else rest.splice(at, 0, moved);

          return { ...b, tasks: rest };
        }),
      };
    }
    case 'ARCHIVE_TASK': {
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.payload.boardId
            ? {
                ...b,
                tasks: b.tasks.map((t) =>
                  t.id === action.payload.taskId
                    ? { ...t, archived: true }
                    : t
                ),
              }
            : b
        ),
      };
    }

    // ── Remote echoes (realtime) ──
    case 'UPSERT_BOARD_REMOTE': {
      const board = action.payload;
      const exists = state.boards.some((b) => b.id === board.id);
      return {
        ...state,
        boards: exists
          ? state.boards.map((b) => (b.id === board.id ? board : b))
          : [...state.boards, board],
      };
    }
    case 'REMOVE_BOARD_REMOTE': {
      const boards = state.boards.filter((b) => b.id !== action.payload);
      return {
        ...state,
        boards,
        activeBoardId:
          state.activeBoardId === action.payload
            ? boards[0]?.id ?? null
            : state.activeBoardId,
      };
    }

    // ── Import ──
    // Used by both file import and the remote sync. Theme and filter are
    // per-device, and the board you're currently looking at is kept selected
    // as long as it still exists in the incoming data.
    case 'IMPORT_STATE': {
      const incoming = normalizeState(action.payload);
      const boards = incoming.boards || [];
      const activeStillExists = boards.some((b) => b.id === state.activeBoardId);

      return {
        ...incoming,
        boards,
        activeBoardId: activeStillExists
          ? state.activeBoardId
          : incoming.activeBoardId ?? boards[0]?.id ?? null,
        theme: state.theme,
        filter: activeStillExists ? state.filter : 'All',
      };
    }

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, defaultState, (initial) => {
    const saved = normalizeState(loadState());
    return saved ? { ...initial, ...saved } : initial;
  });

  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Blocks remote writes until the first workspace load has finished, so a
  // fresh browser can't push emptiness over what's already stored.
  const [hydrated, setHydrated] = useState(() => !isRemoteEnabled());
  const [syncStatus, setSyncStatus] = useState(
    isRemoteEnabled() ? 'saving' : SYNC_OFF
  );

  // Read inside effects without re-running them on every keystroke.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Previous board objects by id, for the per-board diff push.
  const knownBoardsRef = useRef(new Map());
  const boardTimersRef = useRef(new Map());

  useEffect(() => {
    saveState(state);
  }, [state]);

  // ── Initial load + one-time migration of local boards ──
  useEffect(() => {
    if (!isRemoteEnabled() || !userId) return;

    let mounted = true;

    (async () => {
      setHydrated(false);
      setSyncStatus('saving');
      const { rows, userState, error } = await fetchWorkspace();
      if (!mounted) return;
      if (error) {
        setSyncStatus('error');
        setHydrated(true);
        return;
      }

      const local = stateRef.current;
      const remoteIds = new Set(rows.map((r) => r.id));

      // Boards this browser has that the server doesn't: first login after
      // using the app locally. Push them up under this account.
      const toMigrate = local.boards.filter((b) => !remoteIds.has(b.id));
      for (const board of toMigrate) {
        await pushBoard(userId, board);
        await reconcileMembers(board);
      }

      const boards = [...rows.map((r) => r.data), ...toMigrate];

      // Sidebar organisation: the server copy wins; otherwise this browser's
      // local one seeds it.
      const org = userState ?? {
        projects: local.projects,
        groups: local.groups,
        activeBoardId: local.activeBoardId,
      };

      // Boards shared by someone else reference the owner's projects, not
      // ours. They are NOT re-filed here: rewriting projectId would be pushed
      // back on the next edit and permanently move the board out of the
      // owner's project (that bug re-filed real boards in Sep 2026). The
      // sidebar groups boards with unknown projects under a synthetic
      // "Shared" section at render time instead.
      const projects = [...(org.projects || [])];

      dispatch({
        type: 'IMPORT_STATE',
        payload: {
          projects,
          groups: org.groups || [],
          boards,
          activeBoardId: org.activeBoardId ?? boards[0]?.id ?? null,
        },
      });

      if (!userState) {
        await pushUserState(userId, {
          projects,
          groups: org.groups || [],
          activeBoardId: org.activeBoardId ?? boards[0]?.id ?? null,
        });
      }

      // Seed the diff baseline so hydration itself doesn't push everything.
      knownBoardsRef.current = new Map(boards.map((b) => [b.id, b]));
      setSyncStatus('synced');
      setHydrated(true);
    })();

    return () => {
      mounted = false;
    };
  }, [userId]);

  // ── Per-board debounced writes, plus deletions ──
  useEffect(() => {
    if (!hydrated || !isRemoteEnabled() || !userId) return;

    const known = knownBoardsRef.current;
    const timers = boardTimersRef.current;
    const currentIds = new Set(state.boards.map((b) => b.id));

    for (const board of state.boards) {
      if (known.get(board.id) === board) continue;
      known.set(board.id, board);

      clearTimeout(timers.get(board.id));
      timers.set(
        board.id,
        setTimeout(async () => {
          timers.delete(board.id);
          setSyncStatus('saving');
          const pushed = await pushBoard(userId, board);
          const members = await reconcileMembers(board);
          setSyncStatus(pushed.error || members.error ? 'error' : 'synced');
        }, REMOTE_SAVE_DELAY)
      );
    }

    for (const id of [...known.keys()]) {
      if (currentIds.has(id)) continue;
      known.delete(id);
      clearTimeout(timers.get(id));
      timers.delete(id);
      deleteBoardRemote(id);
    }
  }, [state.boards, hydrated, userId]);

  // ── Debounced sidebar-organisation writes ──
  useEffect(() => {
    if (!hydrated || !isRemoteEnabled() || !userId) return;
    const timer = setTimeout(() => {
      pushUserState(userId, stateRef.current);
    }, REMOTE_SAVE_DELAY);
    return () => clearTimeout(timer);
  }, [state.projects, state.groups, state.activeBoardId, hydrated, userId]);

  // ── Realtime: other people's board changes appear live ──
  useEffect(() => {
    if (!hydrated || !isRemoteEnabled() || !userId) return;

    const unsubscribe = subscribeBoards((payload) => {
      if (payload.eventType === 'DELETE') {
        const gone = payload.old?.id;
        if (gone && knownBoardsRef.current.has(gone)) {
          knownBoardsRef.current.delete(gone);
          dispatch({ type: 'REMOVE_BOARD_REMOTE', payload: gone });
        }
        return;
      }

      const row = payload.new;
      if (!row?.data) return;
      // Our own write echoing back - and same-account echoes from another
      // tab would fight the debounce, so let reloads handle those.
      if (row.updated_by === userId) return;

      const current = stateRef.current.boards.find((b) => b.id === row.id);
      if (current && JSON.stringify(current) === JSON.stringify(row.data)) {
        return;
      }

      // A board shared with us mid-session references the sharer's project;
      // keep whatever placement we already gave it, or park it in Shared.
      const placed = current
        ? { ...row.data, projectId: current.projectId, groupId: current.groupId }
        : row.data;

      knownBoardsRef.current.set(row.id, placed);
      dispatch({ type: 'UPSERT_BOARD_REMOTE', payload: placed });
    });

    return unsubscribe;
  }, [hydrated, userId]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  return (
    <AppContext.Provider value={{ state, dispatch, syncStatus }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
