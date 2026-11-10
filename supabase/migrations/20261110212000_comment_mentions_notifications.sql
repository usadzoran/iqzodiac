-- Notify users mentioned in Feed comments and replies.
create or replace function public.iqzodiac_create_comment_mention_notifications()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  mention text;
  recipient uuid;
  actor_name text;
begin
  if new.body is null or position('@' in new.body) = 0 then return new; end if;

  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.handle), ''), 'Someone')
    into actor_name
    from public.profiles p
   where p.user_id = new.author_id;

  for mention in
    select distinct lower(match[2])
      from regexp_matches(new.body, '(^|[[:space:]])@([A-Za-z0-9._-]{1,24})', 'g') as match
  loop
    select p.user_id into recipient
      from public.profiles p
     where lower(ltrim(p.handle, '@')) = mention
     limit 1;

    if recipient is not null and recipient <> new.author_id then
      insert into public.notifications (recipient_id, actor_id, notification_type, post_id, comment_id, message)
      values (recipient, new.author_id, 'comment_reply', new.post_id, new.id,
        coalesce(actor_name, 'Someone') || ' mentioned you in a comment reply.');
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists comment_mention_notification_trigger on public.comments;
create trigger comment_mention_notification_trigger
after insert on public.comments
for each row execute function public.iqzodiac_create_comment_mention_notifications();

revoke all on function public.iqzodiac_create_comment_mention_notifications() from public, anon, authenticated;
