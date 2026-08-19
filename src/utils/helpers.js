export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function createBoard(name, color = '#3b82f6', members = []) {
  return {
    id: generateId(),
    name,
    color,
    members,
    columns: [
      { id: generateId(), name: 'To Do', sortBy: DEFAULT_SORT },
      { id: generateId(), name: 'In Progress', sortBy: DEFAULT_SORT },
      { id: generateId(), name: 'Done', sortBy: DEFAULT_SORT },
    ],
    tasks: [],
  };
}

export const LEVEL_MIN = 1;
export const LEVEL_MAX = 5;
export const LEVEL_DEFAULT = 3;

export function createTask({
  title,
  columnId,
  assignee = 'Unassigned',
  description = '',
  dueDate = '',
  impact = LEVEL_DEFAULT,
  time = LEVEL_DEFAULT,
}) {
  return {
    id: generateId(),
    title,
    description,
    assignee,
    columnId,
    createdAt: new Date().toISOString(),
    dueDate,
    impact,
    time,
    archived: false,
  };
}

function clampLevel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return LEVEL_DEFAULT;
  return Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, n));
}

export const IMPACT_WEIGHT = 0.6;
export const TIME_WEIGHT = 0.4;

// Impact pushes priority up, time pulls it down, weighted 60/40. Scaled to
// 0-100 so every combination lands somewhere on a readable scale:
//   high impact + low time  = 100  (do this first)
//   high impact + high time =  60
//   low impact  + low time  =  40
//   low impact  + high time =   0  (do this last)
// Impact outweighing time is what puts the big-but-slow task above the
// small-and-quick one.
export function getPriority(task) {
  const span = LEVEL_MAX - LEVEL_MIN;
  const impact = (clampLevel(task?.impact) - LEVEL_MIN) / span;
  const time = (clampLevel(task?.time) - LEVEL_MIN) / span;
  const score = IMPACT_WEIGHT * impact - TIME_WEIGHT * time + TIME_WEIGHT;

  return Math.round(score * 100);
}

export const BOARD_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

/* ── Sorting ──
   Add an entry here and sortTasks below to expose a new column sort option. */
export const SORT_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'priority', label: 'Priority' },
  { value: 'impact', label: 'Impact' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'assignee', label: 'Assignee' },
];

export const DEFAULT_SORT = 'manual';

export function sortTasks(tasks, sortBy) {
  if (!sortBy || sortBy === DEFAULT_SORT) return tasks;

  const sorted = [...tasks];

  switch (sortBy) {
    // Soonest first; tasks with no due date sink to the bottom.
    case 'dueDate':
      return sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });

    // Highest first for both.
    case 'priority':
      return sorted.sort((a, b) => getPriority(b) - getPriority(a));

    case 'impact':
      return sorted.sort(
        (a, b) => clampLevel(b?.impact) - clampLevel(a?.impact)
      );

    // A→Z; Unassigned sinks to the bottom.
    case 'assignee':
      return sorted.sort((a, b) => {
        const nameA = a.assignee || 'Unassigned';
        const nameB = b.assignee || 'Unassigned';
        if (nameA === nameB) return 0;
        if (nameA === 'Unassigned') return 1;
        if (nameB === 'Unassigned') return -1;
        return nameA.localeCompare(nameB);
      });

    default:
      return tasks;
  }
}

// Open tasks = not archived and not sitting in the final column. The app
// already treats the last column as done: the Complete button moves a task
// there, and Archive is only offered once it is. Boards with a single column
// have nowhere to be "done", so everything unarchived counts.
export function countOpenTasks(board) {
  const columns = board.columns || [];
  const tasks = board.tasks || [];
  const doneColumnId = columns.length > 1 ? columns[columns.length - 1].id : null;

  return tasks.filter(
    (t) => !t.archived && (doneColumnId === null || t.columnId !== doneColumnId)
  ).length;
}
