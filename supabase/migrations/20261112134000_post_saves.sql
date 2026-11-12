-- Private saved posts: each member can read and remove only their own saves.
create table if not exists public.post_saves (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_saves_user_idx on public.post_saves(user_id, created_at desc);
create index if not exists post_saves_post_idx on public.post_saves(post_id, created_at desc);

alter table public.post_saves enable row level security;
alter table public.post_saves force row level security;
revoke all on table public.post_saves from anon, authenticated;
grant select, insert, delete on table public.post_saves to authenticated;

drop policy if exists post_saves_owner_read on public.post_saves;
create policy post_saves_owner_read on public.post_saves for select to authenticated using (auth.uid() = user_id);
drop policy if exists post_saves_owner_insert on public.post_saves;
create policy post_saves_owner_insert on public.post_saves for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists post_saves_owner_delete on public.post_saves;
create policy post_saves_owner_delete on public.post_saves for delete to authenticated using (auth.uid() = user_id);
