import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useState,
  useRef,
} from 'react';
import {
  loadState,
  saveState,
  loadRemoteState,
  saveRemoteState,
  isRemoteEnabled,
} from '../utils/storage';
import {
  createBoard,
  createTask,
  generateId,
  DEFAULT_SORT,
} from '../utils/helpers';

const AppContext = createContext();

const REMOTE_SAVE_DELAY = 800;

// 'off'    — no Supabase credentials, this browser only
// 'saving' — a write is in flight
// 'synced' — last read/write succeeded
// 'error'  — last read/write failed (paused project, network, bad policy)
const SYNC_OFF = 'off';

const defaultState = {
  boards: [],
  activeBoardId: null,
  theme: 'dark',
  filter: 'All',
};

function reducer(state, action) {
  switch (action.type) {
    // ── Theme ──
    case 'TOGGLE_THEME':
      return { ...state, theme: state.theme === 'dark' ? 'light' : 'dark' };

    // ── Filter ──
    case 'SET_FILTER':
      return { ...state, filter: action.payload };

    // ── Boards ──
    case 'ADD_BOARD': {
      const board = createBoard(
        action.payload.name,
        action.payload.color,
        action.payload.members
      );
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
        boards: state.boards.map((b) =>
          b.id === boardId
            ? {
                ...b,
                tasks: b.tasks.map((t) =>
                  t.id === taskId ? { ...t, columnId: targetColumnId } : t
                ),
              }
            : b
        ),
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
          const moved = { ...moving, columnId: targetColumnId };
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

    // ── Import ──
    // Used by both file import and the remote sync. Theme and filter are
    // per-device, and the board you're currently looking at is kept selected
    // as long as it still exists in the incoming data.
    case 'IMPORT_STATE': {
      const incoming = action.payload;
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
    const saved = loadState();
    return saved ? { ...initial, ...saved } : initial;
  });

  // Blocks remote writes until the first remote read has finished, so a fresh
  // browser can't upload its empty state over what's already stored.
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState(
    isRemoteEnabled() ? 'saving' : SYNC_OFF
  );

  // Read inside the one-shot hydration effect without re-running it.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { state: remote, error } = await loadRemoteState();
      if (!mounted) return;

      // If an empty browser reached the table first it will have stored an
      // empty state. Don't let that come back and wipe boards we already have
      // locally — the next save pushes the local ones up instead.
      const remoteIsEmpty = !remote?.boards?.length;
      const haveLocalBoards = stateRef.current.boards.length > 0;

      if (remote && !(remoteIsEmpty && haveLocalBoards)) {
        dispatch({ type: 'IMPORT_STATE', payload: remote });
      }
      setHydrated(true);
      if (isRemoteEnabled()) {
        setSyncStatus(error ? 'error' : 'synced');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !isRemoteEnabled()) return;

    // Coalesce bursts of edits into a single write.
    let current = true;
    const timer = setTimeout(async () => {
      setSyncStatus('saving');
      const { error } = await saveRemoteState(state);
      if (current) setSyncStatus(error ? 'error' : 'synced');
    }, REMOTE_SAVE_DELAY);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [state, hydrated]);

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
