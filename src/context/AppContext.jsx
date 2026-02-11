import { createContext, useContext, useReducer, useEffect } from 'react';
import {
  loadState,
  saveState,
  loadRemoteState,
  saveRemoteState,
} from '../utils/storage';
import { createBoard, createTask, generateId } from '../utils/helpers';

const AppContext = createContext();

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
                  { id: generateId(), name: action.payload.name },
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
      const { boardId, title, columnId, assignee, description, dueDate } =
        action.payload;
      const task = createTask(title, columnId, assignee, description, dueDate);
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
    case 'IMPORT_STATE':
      return {
        ...action.payload,
        theme: state.theme,
      };

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, defaultState, (initial) => {
    const saved = loadState();
    return saved ? { ...initial, ...saved } : initial;
  });

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const remote = await loadRemoteState();
      if (remote && mounted) {
        dispatch({ type: 'IMPORT_STATE', payload: remote });
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    saveRemoteState(state);
  }, [state]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
