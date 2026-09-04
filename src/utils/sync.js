import { supabase } from '../lib/supabaseClient';

// Cloud persistence, one row per board plus a per-user sidebar row.
// Every function resolves with { error } rather than throwing, so the sync
// status indicator can report failures without crashing anything.

export function isRemoteEnabled() {
  return Boolean(supabase);
}

export async function fetchWorkspace() {
  const [boardsRes, stateRes] = await Promise.all([
    supabase.from('boards').select('id, owner_id, data, updated_at'),
    supabase.from('user_state').select('data').maybeSingle(),
  ]);

  const error = boardsRes.error || stateRes.error;
  if (error) {
    console.error('Failed to load workspace:', error);
    return { error };
  }

  return {
    rows: boardsRes.data || [],
    userState: stateRes.data?.data ?? null,
    error: null,
  };
}

// Update first and only insert when the row doesn't exist yet, so pushing a
// shared board never rewrites its owner.
export async function pushBoard(userId, board) {
  const { data, error } = await supabase
    .from('boards')
    .update({ data: board, updated_by: userId })
    .eq('id', board.id)
    .select('id');

  if (error) {
    console.error('Failed to save board:', error);
    return { error };
  }
  if (data.length > 0) return { error: null };

  const inserted = await supabase
    .from('boards')
    .insert({ id: board.id, owner_id: userId, data: board, updated_by: userId });

  // 23505 = someone else inserted it first; the next update wins normally.
  if (inserted.error && inserted.error.code !== '23505') {
    console.error('Failed to create board:', inserted.error);
    return { error: inserted.error };
  }
  return { error: null };
}

export async function deleteBoardRemote(boardId) {
  const { error } = await supabase.from('boards').delete().eq('id', boardId);
  if (error) console.error('Failed to delete board:', error);
  return { error: error ?? null };
}

export async function pushUserState(userId, state) {
  const payload = {
    projects: state.projects,
    groups: state.groups,
    activeBoardId: state.activeBoardId,
  };
  const { error } = await supabase
    .from('user_state')
    .upsert({ user_id: userId, data: payload }, { onConflict: 'user_id' });
  if (error) console.error('Failed to save user state:', error);
  return { error: error ?? null };
}

// Mirrors a board's collaborator emails into board_members, which is what
// actually grants access.
export async function reconcileMembers(board) {
  const wanted = Array.from(
    new Set(
      (board.members || [])
        .map((m) => (typeof m === 'string' ? '' : m.email || '').trim().toLowerCase())
        .filter(Boolean)
    )
  );

  const { data: existing, error } = await supabase
    .from('board_members')
    .select('email')
    .eq('board_id', board.id);
  if (error) {
    console.error('Failed to read members:', error);
    return { error };
  }

  const have = new Set(existing.map((r) => r.email.toLowerCase()));
  const toAdd = wanted
    .filter((e) => !have.has(e))
    .map((email) => ({ board_id: board.id, email }));
  const toRemove = [...have].filter((e) => !wanted.includes(e));

  if (toAdd.length > 0) {
    const { error: addError } = await supabase.from('board_members').insert(toAdd);
    if (addError && addError.code !== '23505') {
      console.error('Failed to add members:', addError);
      return { error: addError };
    }
  }
  if (toRemove.length > 0) {
    const { error: rmError } = await supabase
      .from('board_members')
      .delete()
      .eq('board_id', board.id)
      .in('email', toRemove);
    if (rmError) {
      console.error('Failed to remove members:', rmError);
      return { error: rmError };
    }
  }
  return { error: null };
}

// Live board changes from other people. The callback receives the raw
// postgres_changes payload; RLS limits delivery to boards this user can see.
export function subscribeBoards(onChange) {
  const channel = supabase
    .channel(`boards-sync-${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'boards' },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
