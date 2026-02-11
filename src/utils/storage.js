import { supabase } from '../lib/supabaseClient';

const STORAGE_KEY = 'kanban-app-state';
const REMOTE_STATE_ID = 'default';

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

export async function loadRemoteState() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('app_state')
    .select('state')
    .eq('id', REMOTE_STATE_ID)
    .maybeSingle();

  if (error) {
    console.error('Failed to load remote state:', error);
    return null;
  }

  return data?.state ?? null;
}

export async function saveRemoteState(state) {
  if (!supabase) return;
  const { error } = await supabase.from('app_state').upsert(
    {
      id: REMOTE_STATE_ID,
      state,
    },
    { onConflict: 'id' }
  );

  if (error) {
    console.error('Failed to save remote state:', error);
  }
}

export function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kanban-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importState(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data && data.boards) {
          resolve(data);
        } else {
          reject(new Error('Invalid data format'));
        }
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
