-- Comment and reply media for posts and Reels.
alter table public.comments
  add column if not exists media_type text,
  add column if not exists media_path text,
  add column if not exists media_mime text,
  add column if not exists media_size_bytes bigint;
alter table public.comments drop constraint if exists comments_body_check;
alter table public.comments add constraint comments_body_or_media_check
  check (char_length(trim(body)) between 0 and 180 and (char_length(trim(body)) > 0 or media_path is not null));
alter table public.comments add constraint comments_media_type_check
  check (media_type is null or media_type in ('image','video','audio'));
alter table public.comments add constraint comments_media_metadata_check
  check ((media_path is null and media_type is null and media_mime is null and media_size_bytes is null)
    or (media_path is not null and media_type is not null and media_mime is not null and media_size_bytes > 0 and media_size_bytes <= 52428800));

alter table public.reel_comments
  add column if not exists media_type text,
  add column if not exists media_path text,
  add column if not exists media_mime text,
  add column if not exists media_size_bytes bigint;
alter table public.reel_comments drop constraint if exists reel_comments_body_check;
alter table public.reel_comments add constraint reel_comments_body_or_media_check
  check (char_length(trim(body)) between 0 and 180 and (char_length(trim(body)) > 0 or media_path is not null));
alter table public.reel_comments add constraint reel_comments_media_type_check
  check (media_type is null or media_type in ('image','video','audio'));
alter table public.reel_comments add constraint reel_comments_media_metadata_check
  check ((media_path is null and media_type is null and media_mime is null and media_size_bytes is null)
    or (media_path is not null and media_type is not null and media_mime is not null and media_size_bytes > 0 and media_size_bytes <= 52428800));

create index if not exists comments_media_path_idx on public.comments(media_path) where media_path is not null;
create index if not exists reel_comments_media_path_idx on public.reel_comments(media_path) where media_path is not null;

-- Authenticated members may read only media referenced by an existing comment.
drop policy if exists iqzodiac_comment_media_read on storage.objects;
create policy iqzodiac_comment_media_read on storage.objects for select to authenticated using (
  bucket_id = 'iqzodiac-media' and (
    exists (select 1 from public.comments c where c.media_path = storage.objects.name)
    or exists (select 1 from public.reel_comments c where c.media_path = storage.objects.name)
  )
);
drop policy if exists iqzodiac_comment_media_insert on storage.objects;
create policy iqzodiac_comment_media_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'iqzodiac-media' and (storage.foldername(name))[1] = auth.uid()::text and (storage.foldername(name))[2] = 'comments'
);
drop policy if exists iqzodiac_comment_media_delete on storage.objects;
create policy iqzodiac_comment_media_delete on storage.objects for delete to authenticated using (
  bucket_id = 'iqzodiac-media' and (storage.foldername(name))[1] = auth.uid()::text and (storage.foldername(name))[2] = 'comments'
);

-- Keep the existing safe profile enrichment while exposing comment media metadata.
drop function if exists public.get_post_comments(uuid[]);
create function public.get_post_comments(p_post_ids uuid[])
returns table(post_id uuid, comment_id uuid, author_id uuid, display_name text, handle text, body text, created_at timestamptz, parent_comment_id uuid, media_type text, media_path text, media_mime text, media_size_bytes bigint)
language sql stable security definer set search_path=public as $$
  select c.post_id, c.id, c.author_id, p.display_name, p.handle, c.body, c.created_at, c.parent_comment_id, c.media_type, c.media_path, c.media_mime, c.media_size_bytes
  from public.comments c join public.profiles p on p.user_id = c.author_id
  where c.post_id = any(p_post_ids)
  order by c.created_at asc;
$$;
revoke all on function public.get_post_comments(uuid[]) from public, anon;
grant execute on function public.get_post_comments(uuid[]) to authenticated;
