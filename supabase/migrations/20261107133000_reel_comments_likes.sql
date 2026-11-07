-- Reactions and comments for short-form Reels.
create table if not exists public.reel_likes (
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reel_id, user_id)
);

create table if not exists public.reel_comments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 180),
  created_at timestamptz not null default now()
);

create index if not exists reel_likes_reel_idx on public.reel_likes(reel_id, created_at desc);
create index if not exists reel_comments_reel_idx on public.reel_comments(reel_id, created_at asc);

alter table public.reel_likes enable row level security;
alter table public.reel_likes force row level security;
alter table public.reel_comments enable row level security;
alter table public.reel_comments force row level security;
revoke all on table public.reel_likes, public.reel_comments from anon, authenticated;
grant select, insert, delete on table public.reel_likes to authenticated;
grant select, insert, delete on table public.reel_comments to authenticated;

drop policy if exists reel_likes_authenticated_read on public.reel_likes;
create policy reel_likes_authenticated_read on public.reel_likes
  for select to authenticated using (true);
drop policy if exists reel_likes_owner_insert on public.reel_likes;
create policy reel_likes_owner_insert on public.reel_likes
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists reel_likes_owner_delete on public.reel_likes;
create policy reel_likes_owner_delete on public.reel_likes
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists reel_comments_authenticated_read on public.reel_comments;
create policy reel_comments_authenticated_read on public.reel_comments
  for select to authenticated using (true);
drop policy if exists reel_comments_owner_insert on public.reel_comments;
create policy reel_comments_owner_insert on public.reel_comments
  for insert to authenticated with check (auth.uid() = author_id);
drop policy if exists reel_comments_owner_delete on public.reel_comments;
create policy reel_comments_owner_delete on public.reel_comments
  for delete to authenticated using (auth.uid() = author_id);
