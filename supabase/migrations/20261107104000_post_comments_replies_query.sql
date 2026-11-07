-- Include the parent comment relationship when loading threaded comments.
drop function if exists public.get_post_comments(uuid[]);
create function public.get_post_comments(p_post_ids uuid[])
returns table(
  post_id uuid,
  comment_id uuid,
  author_id uuid,
  display_name text,
  handle text,
  body text,
  created_at timestamptz,
  parent_comment_id uuid
)
language sql stable security definer set search_path = public
as $$
  select c.post_id, c.id, c.author_id, p.display_name, p.handle, c.body, c.created_at, c.parent_comment_id
  from public.comments c
  join public.profiles p on p.user_id = c.author_id
  where auth.uid() is not null and c.post_id = any(p_post_ids)
  order by c.created_at asc;
$$;
revoke all on function public.get_post_comments(uuid[]) from public, anon;
grant execute on function public.get_post_comments(uuid[]) to authenticated;
