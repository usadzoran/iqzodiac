-- Threaded comment replies with notifications for the person whose comment was answered.

alter table public.comments add column if not exists parent_comment_id uuid references public.comments(id) on delete cascade;
create index if not exists comments_parent_idx on public.comments(parent_comment_id, created_at);

alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
  check (notification_type in ('post_like', 'post_comment', 'private_message', 'profile_like', 'profile_follow', 'comment_reply'));

create or replace function public.iqzodiac_create_comment_reply_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_recipient uuid; v_actor_name text;
begin
  if new.parent_comment_id is null then return new; end if;
  select c.author_id into v_recipient from public.comments c where c.id = new.parent_comment_id;
  if v_recipient is null or v_recipient = new.author_id then return new; end if;
  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.handle), ''), 'Someone') into v_actor_name
    from public.profiles p where p.user_id = new.author_id;
  insert into public.notifications (recipient_id, actor_id, notification_type, post_id, comment_id, message)
  values (v_recipient, new.author_id, 'comment_reply', new.post_id, new.id, coalesce(v_actor_name, 'Someone') || ' replied to your comment.');
  return new;
end;
$$;

drop trigger if exists comment_reply_notification_trigger on public.comments;
create trigger comment_reply_notification_trigger
after insert on public.comments
for each row execute function public.iqzodiac_create_comment_reply_notification();
revoke all on function public.iqzodiac_create_comment_reply_notification() from public, anon, authenticated;
