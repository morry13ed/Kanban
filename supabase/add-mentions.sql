-- @mention notifications - run once in the Supabase SQL editor, after
-- schema.sql. Safe to re-run.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  board_id text not null references public.boards (id) on delete cascade,
  task_id text not null,
  task_title text not null default '',
  author_email text not null,
  author_name text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx
  on public.notifications (lower(recipient_email), created_at desc);

-- Only someone with access to the board may be notified about it: an
-- invited member, or the board's owner.
create or replace function public.can_be_notified(b_id text, r_email text)
returns boolean language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.board_members m
    where m.board_id = b_id and lower(m.email) = lower(r_email)
  ) or exists (
    select 1 from public.boards b
    join public.profiles p on p.id = b.owner_id
    where b.id = b_id and lower(p.email) = lower(r_email)
  );
$$;

alter table public.notifications enable row level security;

drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications"
  on public.notifications for select to authenticated
  using (lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "mark own notifications" on public.notifications;
create policy "mark own notifications"
  on public.notifications for update to authenticated
  using (lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "delete own notifications" on public.notifications;
create policy "delete own notifications"
  on public.notifications for delete to authenticated
  using (lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Members of a board tag each other, signing as themselves.
drop policy if exists "members send notifications" on public.notifications;
create policy "members send notifications"
  on public.notifications for insert to authenticated
  with check (
    public.can_access_board(board_id)
    and public.can_be_notified(board_id, recipient_email)
    and lower(author_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Realtime: the bell lights up without a reload.
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
