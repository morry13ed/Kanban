export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function createBoard(name, color = '#3b82f6') {
  return {
    id: generateId(),
    name,
    color,
    columns: [
      { id: generateId(), name: 'To Do' },
      { id: generateId(), name: 'In Progress' },
      { id: generateId(), name: 'Done' },
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

export const USERS = ['Itay', 'Morry', 'Unassigned'];
export const FILTER_OPTIONS = ['All', 'Itay', 'Morry', 'Unassigned'];

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
