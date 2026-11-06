-- Post activity notifications: server-generated, RLS-protected, realtime-ready.
-- Notifications are created by database triggers so clients cannot forge them.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (notification_type in ('post_like', 'post_comment')),
  post_id uuid not null references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  message text not null check (char_length(trim(message)) between 1 and 500),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_comment_required check (notification_type <> 'post_comment' or comment_id is not null),
  constraint notifications_not_self check (recipient_id <> actor_id)
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;
create unique index if not exists notifications_like_once_per_actor_post_idx
  on public.notifications (actor_id, post_id, notification_type)
  where notification_type = 'post_like';

alter table public.notifications enable row level security;
alter table public.notifications force row level security;
revoke all on public.notifications from anon, authenticated;
grant select, update on public.notifications to authenticated;

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
  for select to authenticated using (recipient_id = auth.uid());
drop policy if exists notifications_mark_own_read on public.notifications;
create policy notifications_mark_own_read on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create or replace function public.iqzodiac_create_post_like_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_recipient uuid;
  v_actor_name text;
begin
  select p.author_id into v_recipient from public.posts p where p.id = new.post_id;
  if v_recipient is null or v_recipient = new.user_id then return new; end if;
  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.handle), ''), 'Someone')
    into v_actor_name from public.profiles p where p.user_id = new.user_id;
  insert into public.notifications (recipient_id, actor_id, notification_type, post_id, message)
  values (v_recipient, new.user_id, 'post_like', new.post_id, coalesce(v_actor_name, 'Someone') || ' liked your post.')
  on conflict (actor_id, post_id, notification_type) where notification_type = 'post_like' do nothing;
  return new;
end;
$$;

create or replace function public.iqzodiac_create_post_comment_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_recipient uuid;
  v_actor_name text;
begin
  select p.author_id into v_recipient from public.posts p where p.id = new.post_id;
  if v_recipient is null or v_recipient = new.author_id then return new; end if;
  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.handle), ''), 'Someone')
    into v_actor_name from public.profiles p where p.user_id = new.author_id;
  insert into public.notifications (recipient_id, actor_id, notification_type, post_id, comment_id, message)
  values (v_recipient, new.author_id, 'post_comment', new.post_id, new.id, coalesce(v_actor_name, 'Someone') || ' commented on your post.')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists post_like_notification_trigger on public.post_likes;
create trigger post_like_notification_trigger
after insert on public.post_likes
for each row execute function public.iqzodiac_create_post_like_notification();
drop trigger if exists post_comment_notification_trigger on public.comments;
create trigger post_comment_notification_trigger
after insert on public.comments
for each row execute function public.iqzodiac_create_post_comment_notification();

revoke all on function public.iqzodiac_create_post_like_notification() from public, anon, authenticated;
revoke all on function public.iqzodiac_create_post_comment_notification() from public, anon, authenticated;

-- Enable realtime once, without failing if the table is already in the publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when undefined_object then
  null;
end $$;
