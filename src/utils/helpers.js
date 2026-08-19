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

export function createTask(title, columnId, assignee = 'Unassigned', description = '', dueDate = '') {
  return {
    id: generateId(),
    title,
    description,
    assignee,
    columnId,
    createdAt: new Date().toISOString(),
    dueDate,
    archived: false,
  };
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
