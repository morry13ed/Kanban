-- Kanban collaboration schema (v2) - run once in the Supabase SQL editor.
-- Replaces the single-row app_state design: one row per board, invited
-- members by email, per-user sidebar state, and realtime on board changes.

-- The old experiment; never held live data.
drop table if exists public.app_state;

-- ── Profiles: one per signed-up user ──
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text
);

alter table public.profiles enable row level security;

drop policy if exists "authenticated can read profiles" on public.profiles;
create policy "authenticated can read profiles"
  on public.profiles for select to authenticated using (true);

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Boards: one row per board, whole board as jsonb ──
create table if not exists public.boards (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- ── Membership: invited by email, so people can be added before they
--    ever sign up; access matches the signed-in user's email ──
create table if not exists public.board_members (
  board_id text not null references public.boards (id) on delete cascade,
  email text not null,
  user_id uuid references auth.users (id) on delete set null,
  primary key (board_id, email)
);

-- ── Per-user sidebar organisation (projects, groups, active board) ──
create table if not exists public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Security definer helper so boards and board_members policies can look at
-- each other without RLS recursion.
create or replace function public.can_access_board(b_id text)
returns boolean language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.boards b
    where b.id = b_id and b.owner_id = auth.uid()
  ) or exists (
    select 1 from public.board_members m
    where m.board_id = b_id
      and (m.user_id = auth.uid()
        or lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

alter table public.boards enable row level security;

drop policy if exists "members read boards" on public.boards;
create policy "members read boards"
  on public.boards for select to authenticated
  using (public.can_access_board(id));

drop policy if exists "owner creates boards" on public.boards;
create policy "owner creates boards"
  on public.boards for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "members update boards" on public.boards;
create policy "members update boards"
  on public.boards for update to authenticated
  using (public.can_access_board(id))
  with check (public.can_access_board(id));

drop policy if exists "owner deletes boards" on public.boards;
create policy "owner deletes boards"
  on public.boards for delete to authenticated
  using (owner_id = auth.uid());

alter table public.board_members enable row level security;

drop policy if exists "members read membership" on public.board_members;
create policy "members read membership"
  on public.board_members for select to authenticated
  using (public.can_access_board(board_id));

drop policy if exists "members manage membership" on public.board_members;
create policy "members manage membership"
  on public.board_members for insert to authenticated
  with check (public.can_access_board(board_id));

drop policy if exists "members remove membership" on public.board_members;
create policy "members remove membership"
  on public.board_members for delete to authenticated
  using (public.can_access_board(board_id));

alter table public.user_state enable row level security;

drop policy if exists "own state" on public.user_state;
create policy "own state"
  on public.user_state for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── updated_at upkeep ──
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists boards_set_updated_at on public.boards;
create trigger boards_set_updated_at
  before update on public.boards
  for each row execute function public.set_updated_at();

drop trigger if exists user_state_set_updated_at on public.user_state;
create trigger user_state_set_updated_at
  before update on public.user_state
  for each row execute function public.set_updated_at();

-- ── Realtime: broadcast board changes to connected members ──
do $$
begin
  alter publication supabase_realtime add table public.boards;
exception when duplicate_object then null;
end $$;
