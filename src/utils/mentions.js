import { normalizeMember } from './helpers';
import { isRemoteEnabled, sendMentionNotifications } from './sync';

// @mentions in task descriptions. A mention is "@" plus a board member's
// exact name, so names with spaces (or in Hebrew) work; longer names win
// when one name starts another ("Dan" vs "Dana").

const WORD = '[\\p{L}\\p{N}_]';

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mentionPattern(names) {
  const unique = Array.from(new Set(names.filter(Boolean))).sort(
    (a, b) => b.length - a.length
  );
  if (unique.length === 0) return null;
  return new RegExp(
    `(?<![\\p{L}\\p{N}_@])@(${unique.map(escapeRegExp).join('|')})(?!${WORD})`,
    'gu'
  );
}

export function mentionedNames(text, names) {
  const pattern = mentionPattern(names);
  if (!pattern || !text) return [];
  return Array.from(new Set([...text.matchAll(pattern)].map((m) => m[1])));
}

// Text broken into plain runs and mention runs, for rendering.
export function splitMentions(text, names) {
  const pattern = mentionPattern(names);
  if (!pattern || !text) return [{ text: text || '' }];
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: match[0], mention: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

// The "@que" being typed right before the caret, if any.
export function mentionQueryAt(text, caret) {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at === -1) return null;
  const prev = at > 0 ? before[at - 1] : '';
  if (prev && !/\s|[([{"'.,;:!?]/.test(prev)) return null;
  const query = before.slice(at + 1);
  if (query.length > 30 || /[\n@]/.test(query)) return null;
  return { start: at, query };
}

// Members newly tagged by this edit who can be told about it: they need an
// email (that's who they are when signed in), and never yourself.
export function newMentionRecipients(members, before, after, selfEmail) {
  const list = (members || []).map(normalizeMember);
  const names = list.map((m) => m.name);
  const had = new Set(mentionedNames(before, names));
  const self = (selfEmail || '').toLowerCase();
  const emails = mentionedNames(after, names)
    .filter((name) => !had.has(name))
    .map((name) => list.find((m) => m.name === name)?.email?.trim().toLowerCase())
    .filter((email) => email && email !== self);
  return Array.from(new Set(emails));
}

// Board pushes are debounced; give the task time to reach the server before
// anyone is pointed at it.
const NOTIFY_DELAY = 2500;

export function notifyNewMentions({
  members,
  boardId,
  taskId,
  taskTitle,
  before,
  after,
  user,
}) {
  if (!isRemoteEnabled() || !user?.email) return;
  const recipients = newMentionRecipients(members, before, after, user.email);
  if (recipients.length === 0) return;
  const self = user.email.toLowerCase();
  const me = (members || [])
    .map(normalizeMember)
    .find((m) => (m.email || '').toLowerCase() === self);
  const authorName = me?.name || user.email.split('@')[0];
  setTimeout(() => {
    sendMentionNotifications(
      recipients.map((email) => ({
        recipient_email: email,
        board_id: boardId,
        task_id: taskId,
        task_title: taskTitle,
        author_email: user.email,
        author_name: authorName,
      }))
    );
  }, NOTIFY_DELAY);
}

// The bell asks whichever board view is mounted to open a task.
const OPEN_TASK_EVENT = 'kanban:open-task';

export function requestOpenTask(taskId) {
  window.dispatchEvent(new CustomEvent(OPEN_TASK_EVENT, { detail: taskId }));
}

export function onOpenTaskRequest(handler) {
  const listener = (e) => handler(e.detail);
  window.addEventListener(OPEN_TASK_EVENT, listener);
  return () => window.removeEventListener(OPEN_TASK_EVENT, listener);
}
