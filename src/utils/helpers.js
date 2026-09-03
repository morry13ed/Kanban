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
      { id: generateId(), name: 'To Do', sortBy: DEFAULT_SORT, type: DEFAULT_COLUMN_TYPE },
      { id: generateId(), name: 'In Progress', sortBy: DEFAULT_SORT, type: DEFAULT_COLUMN_TYPE },
      { id: generateId(), name: 'Done', sortBy: DEFAULT_SORT, type: DEFAULT_COLUMN_TYPE },
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
  demand = LEVEL_MIN,
  isBug = false,
  isFeature = false,
  attachments = [],
  status = STATUS_NONE,
}) {
  return {
    id: generateId(),
    title,
    description,
    assignee,
    columnId,
    createdAt: new Date().toISOString(),
    movedAt: new Date().toISOString(),
    dueDate,
    impact,
    time,
    demand,
    isBug,
    isFeature,
    attachments,
    status,
    archived: false,
  };
}

// Levels are continuous, so keep a sane number of decimals in storage.
export function roundLevel(value) {
  return Math.round(Number(value) * 100) / 100;
}

export function formatLevel(value) {
  return Number(clampLevel(value)).toFixed(1);
}

function clampLevel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return LEVEL_DEFAULT;
  return Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, n));
}

export const DEMAND_WEIGHT = 0.5;
export const IMPACT_WEIGHT = 0.3;
export const TIME_WEIGHT = 0.2;

// Demand (it has to happen) carries double impact's weight, and duration
// pulls down but can never bury a high-demand task. Scaled to 0-100:
//   max demand + max impact + short duration = 100
//   max demand alone, slow and low impact    =  50
//   no demand, high impact, short duration   =  50
//   no demand, low impact, long duration     =   0
// A task predating the demand slider defaults to no demand, so its score
// re-settles on the new scale without jumping any queue.
export function getPriority(task) {
  const span = LEVEL_MAX - LEVEL_MIN;
  const demand = (clampLevel(task?.demand ?? LEVEL_MIN) - LEVEL_MIN) / span;
  const impact = (clampLevel(task?.impact) - LEVEL_MIN) / span;
  const time = (clampLevel(task?.time) - LEVEL_MIN) / span;
  const score =
    DEMAND_WEIGHT * demand +
    IMPACT_WEIGHT * impact -
    TIME_WEIGHT * time +
    TIME_WEIGHT;

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
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Score' },
  { value: 'impact', label: 'Impact' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'assignee', label: 'Assignee' },
];

export const DEFAULT_SORT = 'manual';

export const COLUMN_REGULAR = 'regular';
export const COLUMN_ACTIVE = 'active';
export const COLUMN_SUCCESS = 'success';
export const DEFAULT_COLUMN_TYPE = COLUMN_REGULAR;

export const COLUMN_TYPES = [
  {
    value: COLUMN_REGULAR,
    label: 'Regular',
    hint: 'Nothing special happens when a task lands here.',
  },
  {
    value: COLUMN_ACTIVE,
    label: 'Active',
    hint: 'Tasks moved into this column are marked active automatically.',
  },
  {
    value: COLUMN_SUCCESS,
    label: 'Success',
    hint: 'Tasks moved into this column set off confetti.',
  },
];

export function isActiveColumn(column) {
  return column?.type === COLUMN_ACTIVE;
}

export function isSuccessColumn(column) {
  return column?.type === COLUMN_SUCCESS;
}

// Purely visual: a hint for the reader about whether work is moving.
export const STATUS_NONE = 'none';
export const STATUS_ACTIVE = 'active';
export const STATUS_PAUSED = 'paused';

export const TASK_STATUS_OPTIONS = [
  { value: STATUS_NONE, label: 'Off', hint: 'No status shown on the card.' },
  {
    value: STATUS_ACTIVE,
    label: 'Active',
    hint: 'Shows a play chip on the card.',
  },
  {
    value: STATUS_PAUSED,
    label: 'Paused',
    hint: 'Shows a pause chip on the card.',
  },
];

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

    // Active, then paused, then no status. Within a rank, whichever task
    // arrived in the column first comes first; movedAt is stamped on every
    // transfer, with createdAt covering tasks from before it existed.
    case 'status': {
      const rank = (t) => {
        if (t?.status === STATUS_ACTIVE) return 0;
        if (t?.status === STATUS_PAUSED) return 1;
        return 2;
      };
      const arrived = (t) => t?.movedAt || t?.createdAt || '';
      return sorted.sort(
        (a, b) => rank(a) - rank(b) || arrived(a).localeCompare(arrived(b))
      );
    }

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

// Upgrades pre-project state to the three-level shape: projects at the top,
// groups inside a project, boards inside a group or directly in a project.
// Old slash-prefixed headings ("Flash/ Design") become a project named
// "Flash"; boards without a prefix collect in a "General" project; group
// names stored by the old Create Group button become empty projects. Board
// names are left untouched. Already-migrated state passes through.
export function normalizeState(saved) {
  if (!saved) return null;
  if (Array.isArray(saved.projects)) {
    return { ...saved, groups: saved.groups || [] };
  }

  const projects = [];
  const byKey = new Map();
  const ensureProject = (name) => {
    const key = name.toLowerCase();
    let project = byKey.get(key);
    if (!project) {
      project = { id: generateId(), name };
      byKey.set(key, project);
      projects.push(project);
    }
    return project;
  };

  const boards = (saved.boards || []).map((board) => {
    const slash = board.name.indexOf('/');
    const prefix = slash > 0 ? board.name.slice(0, slash).trim() : '';
    const project = ensureProject(prefix || 'General');
    return { ...board, projectId: project.id, groupId: null };
  });

  for (const name of saved.groups || []) {
    if (typeof name === 'string') ensureProject(name);
  }

  return { ...saved, projects, groups: [], boards };
}

// ── Member colours ──
export const DEFAULT_MEMBER_COLOR = '#3b82f6';

export function normalizeMember(member) {
  return typeof member === 'string'
    ? { name: member, email: '', color: undefined }
    : member;
}

export function getMemberColor(board, name) {
  const member = (board?.members || [])
    .map(normalizeMember)
    .find((m) => m.name === name);
  return member?.color || DEFAULT_MEMBER_COLOR;
}

export function isValidHex(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

// Dark lettering on bright backgrounds, white on dark ones.
export function readableTextOn(hex) {
  if (!isValidHex(hex)) return '#ffffff';
  const channel = (i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const luminance =
    0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.45 ? '#1a1d2b' : '#ffffff';
}

export function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) =>
    Math.round(
      255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))
    )
      .toString(16)
      .padStart(2, '0');
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Hue of a hex colour, for positioning the slider when a hex is typed.
export function hexHue(hex) {
  if (!isValidHex(hex)) return 220;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round((h * 60 + 360) % 360);
}
