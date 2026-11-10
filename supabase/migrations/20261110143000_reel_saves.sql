-- Saved Reels: one private save per user and Reel.
create table if not exists public.reel_saves (
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reel_id, user_id)
);

create index if not exists reel_saves_user_idx on public.reel_saves(user_id, created_at desc);
create index if not exists reel_saves_reel_idx on public.reel_saves(reel_id, created_at desc);

alter table public.reel_saves enable row level security;
alter table public.reel_saves force row level security;
revoke all on table public.reel_saves from anon, authenticated;
grant select, insert, delete on table public.reel_saves to authenticated;

drop policy if exists reel_saves_owner_read on public.reel_saves;
create policy reel_saves_owner_read on public.reel_saves
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists reel_saves_owner_insert on public.reel_saves;
create policy reel_saves_owner_insert on public.reel_saves
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists reel_saves_owner_delete on public.reel_saves;
create policy reel_saves_owner_delete on public.reel_saves
  for delete to authenticated using (auth.uid() = user_id);
