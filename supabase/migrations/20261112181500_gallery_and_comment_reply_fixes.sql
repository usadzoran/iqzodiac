-- Keep Post comment editing limited to the text field exposed by the UI.
revoke update on table public.comments from authenticated;
grant update (body) on table public.comments to authenticated;

-- Ensure the Reel notification schema exists even when applying this migration to a fresh project.
alter table public.notifications
  add column if not exists reel_id uuid,
  add column if not exists reel_comment_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and conname = 'notifications_reel_id_fkey'
  ) then
    alter table public.notifications
      add constraint notifications_reel_id_fkey
      foreign key (reel_id) references public.reels(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and conname = 'notifications_reel_comment_id_fkey'
  ) then
    alter table public.notifications
      add constraint notifications_reel_comment_id_fkey
      foreign key (reel_comment_id) references public.reel_comments(id) on delete cascade;
  end if;
end;
$$;

alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
  check (notification_type in ('post_like', 'post_comment', 'private_message', 'profile_like', 'profile_follow', 'comment_reply', 'reel_like', 'reel_comment')) not valid;
alter table public.notifications drop constraint if exists notifications_reel_comment_required;
alter table public.notifications add constraint notifications_reel_comment_required
  check (notification_type <> 'reel_comment' or reel_comment_id is not null) not valid;
alter table public.notifications drop constraint if exists notifications_target_required;
alter table public.notifications add constraint notifications_target_required
  check (((notification_type in ('reel_like', 'reel_comment')) and reel_id is not null) or notification_type not in ('reel_like', 'reel_comment')) not valid;

create unique index if not exists notifications_reel_comment_once_idx
  on public.notifications(reel_comment_id)
  where notification_type = 'reel_comment' and reel_comment_id is not null;

-- Reply attachments on Reels use the same private storage policy as Post replies.
drop policy if exists iqzodiac_comment_media_read on storage.objects;
create policy iqzodiac_comment_media_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'iqzodiac-media'
    and (
      exists (
        select 1 from public.comments c
        where c.media_path = storage.objects.name
          and c.media_path is not null
      )
      or exists (
        select 1 from public.reel_comments rc
        where rc.media_path = storage.objects.name
          and rc.media_path is not null
      )
    )
  );

drop policy if exists iqzodiac_comment_media_delete on storage.objects;
create policy iqzodiac_comment_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'iqzodiac-media'
    and (
      exists (
        select 1 from public.comments c
        where c.media_path = storage.objects.name
          and c.author_id = auth.uid()
      )
      or exists (
        select 1 from public.reel_comments rc
        where rc.media_path = storage.objects.name
          and rc.author_id = auth.uid()
      )
    )
  );

-- Notify the parent commenter when a Reel comment receives a reply; notify the Reel owner for root comments.
create or replace function public.iqzodiac_create_reel_comment_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_recipient uuid;
  v_actor_name text;
  v_message text;
begin
  if new.parent_comment_id is not null then
    select parent.author_id into v_recipient
    from public.reel_comments parent
    where parent.id = new.parent_comment_id and parent.reel_id = new.reel_id;
  else
    select r.author_id into v_recipient
    from public.reels r
    where r.id = new.reel_id;
  end if;

  if v_recipient is null or v_recipient = new.author_id then
    return new;
  end if;

  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.handle), ''), 'Someone')
    into v_actor_name
  from public.profiles p
  where p.user_id = new.author_id;

  if new.parent_comment_id is not null then
    v_message := coalesce(v_actor_name, 'Someone') || ' replied to your comment on a Reel.';
  else
    v_message := coalesce(v_actor_name, 'Someone') || ' commented on your Reel.';
  end if;

  insert into public.notifications (
    recipient_id, actor_id, notification_type, reel_id, reel_comment_id, message
  )
  values (
    v_recipient,
    new.author_id,
    'reel_comment',
    new.reel_id,
    new.id,
    v_message
  )
  on conflict (reel_comment_id)
    where notification_type = 'reel_comment' and reel_comment_id is not null
  do nothing;

  return new;
end;
$$;
revoke all on function public.iqzodiac_create_reel_comment_notification() from public, anon, authenticated;

drop trigger if exists reel_comment_notification_trigger on public.reel_comments;
create trigger reel_comment_notification_trigger
after insert on public.reel_comments
for each row execute function public.iqzodiac_create_reel_comment_notification();
