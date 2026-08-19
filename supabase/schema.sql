-- Kanban remote state — run once in the Supabase SQL editor.
--
-- The whole app state lives in a single row (id = 'default').
-- This is the single-user setup: there is no auth, so the policies below
-- let anyone holding the site URL read and write that row. The anon key is
-- embedded in the client bundle and is not a secret. Do not put anything
-- private in here until these policies are scoped to an authenticated user.

create table if not exists public.app_state (
  id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "anon can read app_state" on public.app_state;
create policy "anon can read app_state"
  on public.app_state for select
  to anon
  using (true);

drop policy if exists "anon can insert app_state" on public.app_state;
create policy "anon can insert app_state"
  on public.app_state for insert
  to anon
  with check (true);

drop policy if exists "anon can update app_state" on public.app_state;
create policy "anon can update app_state"
  on public.app_state for update
  to anon
  using (true)
  with check (true);

-- Lets you confirm from the dashboard that a save actually landed.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_state_set_updated_at on public.app_state;
create trigger app_state_set_updated_at
  before update on public.app_state
  for each row execute function public.set_updated_at();
