import { useSyncExternalStore } from 'react';

// Show only bugs or only features in one column. A personal view: it lives in
// this browser, never in the board, so collaborators keep seeing everything.

export const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'bug', label: 'Bugs' },
  { value: 'feature', label: 'Features' },
];

const STORAGE_KEY = 'kanban-column-filters';
const listeners = new Set();

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

let cache = readAll();

const keyOf = (boardId, columnId) => `${boardId}:${columnId}`;

export function getColumnFilter(boardId, columnId) {
  const value = cache[keyOf(boardId, columnId)];
  return TYPE_FILTERS.some((f) => f.value === value) ? value : 'all';
}

export function setColumnFilter(boardId, columnId, value) {
  const next = { ...cache };
  if (value === 'all') delete next[keyOf(boardId, columnId)];
  else next[keyOf(boardId, columnId)] = value;
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or full storage: the filter still holds for this visit.
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useColumnFilter(boardId, columnId) {
  return useSyncExternalStore(subscribe, () =>
    getColumnFilter(boardId, columnId)
  );
}

export function matchesTypeFilter(task, filter) {
  if (filter === 'bug') return Boolean(task.isBug);
  if (filter === 'feature') return Boolean(task.isFeature);
  return true;
}

// Re-render on any filter change, for views that pick their column later.
export function useColumnFiltersVersion() {
  return useSyncExternalStore(subscribe, () => cache);
}
