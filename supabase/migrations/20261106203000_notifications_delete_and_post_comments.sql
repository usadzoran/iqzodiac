-- Allow members to delete their own notifications and expose post comments safely.

grant delete on public.notifications to authenticated;

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (recipient_id = auth.uid());

create or replace function public.get_post_comments(p_post_ids uuid[])
returns table(
  post_id uuid,
  comment_id uuid,
  author_id uuid,
  display_name text,
  handle text,
  body text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.post_id, c.id, c.author_id, p.display_name, p.handle, c.body, c.created_at
  from public.comments c
  join public.profiles p on p.user_id = c.author_id
  where auth.uid() is not null
    and c.post_id = any(p_post_ids)
  order by c.created_at asc;
$$;

revoke all on function public.get_post_comments(uuid[]) from public, anon;
grant execute on function public.get_post_comments(uuid[]) to authenticated;
