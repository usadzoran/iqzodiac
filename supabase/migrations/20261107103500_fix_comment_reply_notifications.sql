-- A reply notifies the original commenter, not the post author twice.
create or replace function public.iqzodiac_create_post_comment_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_recipient uuid; v_actor_name text;
begin
  if new.parent_comment_id is not null then return new; end if;
  select p.author_id into v_recipient from public.posts p where p.id = new.post_id;
  if v_recipient is null or v_recipient = new.author_id then return new; end if;
  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.handle), ''), 'Someone') into v_actor_name from public.profiles p where p.user_id = new.author_id;
  insert into public.notifications (recipient_id, actor_id, notification_type, post_id, comment_id, message)
  values (v_recipient, new.author_id, 'post_comment', new.post_id, new.id, coalesce(v_actor_name, 'Someone') || ' commented on your post.');
  return new;
end;
$$;
revoke all on function public.iqzodiac_create_post_comment_notification() from public, anon, authenticated;
