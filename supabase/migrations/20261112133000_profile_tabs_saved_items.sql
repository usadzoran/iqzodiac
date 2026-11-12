-- User-owned saved posts and Reels. The exclusive item constraint and partial unique
-- indexes prevent mixed references and duplicate saves.
-- Earlier installations may already have this column; clean installs need it to
-- distinguish feed posts from other post records without changing existing rows.
alter table public.posts
  add column if not exists post_type text not null default 'post';

create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('post', 'reel')),
  post_id uuid references public.posts(id) on delete cascade,
  reel_id uuid references public.reels(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_items_exactly_one_item check (
    (item_type = 'post' and post_id is not null and reel_id is null)
    or (item_type = 'reel' and reel_id is not null and post_id is null)
  )
);

create unique index if not exists saved_items_user_post_uidx
  on public.saved_items(user_id, post_id) where post_id is not null;
create unique index if not exists saved_items_user_reel_uidx
  on public.saved_items(user_id, reel_id) where reel_id is not null;
create index if not exists saved_items_user_created_idx
  on public.saved_items(user_id, created_at desc, id desc);

alter table public.saved_items enable row level security;
alter table public.saved_items force row level security;

drop policy if exists saved_items_owner_select on public.saved_items;
create policy saved_items_owner_select on public.saved_items
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists saved_items_owner_insert on public.saved_items;
create policy saved_items_owner_insert on public.saved_items
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists saved_items_owner_delete on public.saved_items;
create policy saved_items_owner_delete on public.saved_items
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, delete on public.saved_items to authenticated;
revoke all on public.saved_items from anon;

create or replace function public.get_profile_posts(
  p_user_id uuid,
  p_sort text default 'latest',
  p_media_only boolean default false,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table(
  post_id uuid,
  author_id uuid,
  body text,
  media_type text,
  media_path text,
  media_mime text,
  post_type text,
  created_at timestamptz,
  like_count bigint,
  comment_count bigint,
  liked_by_me boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    p.author_id,
    p.body,
    p.media_type,
    p.media_path,
    p.media_mime,
    p.post_type,
    p.created_at,
    (select count(*) from public.post_likes l where l.post_id = p.id),
    (select count(*) from public.comments c where c.post_id = p.id),
    exists(select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid())
  from public.posts p
  where auth.uid() is not null
    and p_user_id = auth.uid()
    and p.post_type = 'post'
    and (not p_media_only or p.media_path is not null)
    and p_sort in ('latest', 'oldest', 'most_liked')
  order by
    case when p_sort = 'oldest' then p.created_at end asc,
    case when p_sort = 'most_liked' then (select count(*) from public.post_likes l where l.post_id = p.id) end desc,
    case when p_sort in ('latest', 'most_liked') then p.created_at end desc,
    p.id desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_profile_comments(
  p_user_id uuid,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table(
  comment_id uuid,
  post_id uuid,
  author_id uuid,
  body text,
  created_at timestamptz,
  parent_comment_id uuid,
  comment_media_type text,
  comment_media_path text,
  post_author_id uuid,
  post_body text,
  post_media_type text,
  post_media_path text,
  post_created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.post_id,
    c.author_id,
    c.body,
    c.created_at,
    c.parent_comment_id,
    c.media_type,
    c.media_path,
    p.author_id,
    p.body,
    p.media_type,
    p.media_path,
    p.created_at
  from public.comments c
  join public.posts p on p.id = c.post_id
  where auth.uid() is not null
    and p_user_id = auth.uid()
    and c.author_id = auth.uid()
    and p.author_id <> auth.uid()
    and p.post_type = 'post'
  order by c.created_at desc, c.id desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.get_profile_posts(uuid, text, boolean, integer, integer) from public, anon;
revoke all on function public.get_profile_comments(uuid, integer, integer) from public, anon;
grant execute on function public.get_profile_posts(uuid, text, boolean, integer, integer) to authenticated;
grant execute on function public.get_profile_comments(uuid, integer, integer) to authenticated;
