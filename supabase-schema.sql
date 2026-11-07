-- Run this SQL in your own Supabase project's SQL Editor.
create table if not exists public.bookmark_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.bookmark_sync enable row level security;
grant select, insert, update on public.bookmark_sync to authenticated;

drop policy if exists "Users can read own bookmark sync" on public.bookmark_sync;
create policy "Users can read own bookmark sync" on public.bookmark_sync
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can insert own bookmark sync" on public.bookmark_sync;
create policy "Users can insert own bookmark sync" on public.bookmark_sync
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can update own bookmark sync" on public.bookmark_sync;
create policy "Users can update own bookmark sync" on public.bookmark_sync
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
