-- Allow authenticated members to publish one image or video with a post.
alter table public.posts
  add column if not exists media_type text,
  add column if not exists media_path text,
  add column if not exists media_mime text,
  add column if not exists media_size_bytes bigint;

alter table public.posts drop constraint if exists posts_body_check;
alter table public.posts
  add constraint posts_body_or_media_check
  check (
    char_length(trim(body)) between 0 and 500
    and (char_length(trim(body)) > 0 or media_path is not null)
    and (media_type is null or media_type in ('image', 'video'))
  );

alter table public.posts
  drop constraint if exists posts_media_metadata_check;
alter table public.posts
  add constraint posts_media_metadata_check
  check ((media_path is null and media_type is null and media_mime is null and media_size_bytes is null)
    or (media_path is not null and media_type is not null and media_mime is not null and media_size_bytes is not null));

create index if not exists posts_media_path_idx on public.posts(media_path) where media_path is not null;

-- Keep the existing private bucket. Post media is readable only by authenticated members
-- and only when the object is referenced by an existing post.
drop policy if exists iqzodiac_post_media_read on storage.objects;
create policy iqzodiac_post_media_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'iqzodiac-media'
    and exists (
      select 1 from public.posts p
      where p.media_path = storage.objects.name
        and p.media_path is not null
    )
  );

drop policy if exists iqzodiac_post_media_insert on storage.objects;
create policy iqzodiac_post_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'iqzodiac-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] = 'posts'
  );

drop function if exists public.get_home_feed(integer);
create function public.get_home_feed(p_limit integer default 30)
returns table(
  post_id uuid,
  author_id uuid,
  display_name text,
  handle text,
  body text,
  media_type text,
  media_path text,
  created_at timestamptz,
  like_count bigint,
  comment_count bigint,
  liked_by_me boolean,
  following boolean
)
language sql stable security definer set search_path=public as $$
  select
    p.id,
    p.author_id,
    pr.display_name,
    pr.handle,
    p.body,
    p.media_type,
    p.media_path,
    p.created_at,
    (select count(*) from public.post_likes l where l.post_id=p.id),
    (select count(*) from public.comments c where c.post_id=p.id),
    exists(select 1 from public.post_likes l where l.post_id=p.id and l.user_id=auth.uid()),
    exists(select 1 from public.follows f where f.follower_id=auth.uid() and f.followed_id=p.author_id)
  from public.posts p
  join public.profiles pr on pr.user_id=p.author_id
  order by p.created_at desc
  limit p_limit;
$$;

revoke execute on function public.get_home_feed(integer) from public, anon;
grant execute on function public.get_home_feed(integer) to authenticated;
