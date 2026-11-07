-- Reel activity notifications and private creator analytics.
-- View counts are unique signed-in viewers who play a Reel for at least three seconds.

alter table public.notifications
  add column if not exists reel_id uuid;
alter table public.notifications
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

alter table public.notifications
  drop constraint if exists notifications_notification_type_check;
alter table public.notifications
  add constraint notifications_notification_type_check
  check (notification_type in (
    'post_like', 'post_comment', 'private_message', 'profile_like',
    'profile_follow', 'comment_reply', 'reel_like', 'reel_comment'
  ));

-- Reel comments have their own foreign key; do not store their IDs in post comment_id.
alter table public.notifications
  drop constraint if exists notifications_comment_required;
alter table public.notifications
  add constraint notifications_comment_required
  check (notification_type not in ('post_comment', 'comment_reply') or comment_id is not null);
alter table public.notifications
  drop constraint if exists notifications_target_required;
alter table public.notifications
  add constraint notifications_target_required
  check (
    (notification_type in ('reel_like', 'reel_comment') and reel_id is not null)
    or notification_type not in ('reel_like', 'reel_comment')
  );
alter table public.notifications
  drop constraint if exists notifications_reel_comment_required;
alter table public.notifications
  add constraint notifications_reel_comment_required
  check (notification_type <> 'reel_comment' or reel_comment_id is not null or comment_id is not null)
  not valid;

create index if not exists notifications_recipient_reel_activity_idx
  on public.notifications (recipient_id, created_at desc)
  where notification_type in ('reel_like', 'reel_comment');
create unique index if not exists notifications_like_once_per_actor_reel_idx
  on public.notifications (actor_id, reel_id, notification_type)
  where notification_type = 'reel_like';
create unique index if not exists notifications_reel_comment_once_idx
  on public.notifications (reel_comment_id)
  where notification_type = 'reel_comment' and reel_comment_id is not null;

create or replace function public.iqzodiac_create_reel_like_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_recipient uuid;
  v_actor_name text;
begin
  select r.author_id into v_recipient
  from public.reels r
  where r.id = new.reel_id;

  if v_recipient is null or v_recipient = new.user_id then
    return new;
  end if;

  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.handle), ''), 'Someone')
    into v_actor_name
  from public.profiles p
  where p.user_id = new.user_id;

  insert into public.notifications (recipient_id, actor_id, notification_type, reel_id, message)
  values (
    v_recipient,
    new.user_id,
    'reel_like',
    new.reel_id,
    coalesce(v_actor_name, 'Someone') || ' liked your Reel.'
  )
  on conflict (actor_id, reel_id, notification_type)
    where notification_type = 'reel_like'
  do nothing;

  return new;
end;
$$;

create or replace function public.iqzodiac_create_reel_comment_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_recipient uuid;
  v_actor_name text;
begin
  select r.author_id into v_recipient
  from public.reels r
  where r.id = new.reel_id;

  if v_recipient is null or v_recipient = new.author_id then
    return new;
  end if;

  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.handle), ''), 'Someone')
    into v_actor_name
  from public.profiles p
  where p.user_id = new.author_id;

  insert into public.notifications (
    recipient_id, actor_id, notification_type, reel_id, reel_comment_id, message
  )
  values (
    v_recipient,
    new.author_id,
    'reel_comment',
    new.reel_id,
    new.id,
    coalesce(v_actor_name, 'Someone') || ' commented on your Reel.'
  )
  on conflict (reel_comment_id)
    where notification_type = 'reel_comment' and reel_comment_id is not null
  do nothing;

  return new;
end;
$$;

drop trigger if exists reel_like_notification_trigger on public.reel_likes;
create trigger reel_like_notification_trigger
after insert on public.reel_likes
for each row execute function public.iqzodiac_create_reel_like_notification();

drop trigger if exists reel_comment_notification_trigger on public.reel_comments;
create trigger reel_comment_notification_trigger
after insert on public.reel_comments
for each row execute function public.iqzodiac_create_reel_comment_notification();

revoke all on function public.iqzodiac_create_reel_like_notification() from public, anon, authenticated;
revoke all on function public.iqzodiac_create_reel_comment_notification() from public, anon, authenticated;

create table if not exists public.reel_views (
  reel_id uuid not null references public.reels(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  primary key (reel_id, viewer_id)
);
alter table public.reel_views
  add column if not exists first_viewed_at timestamptz not null default now();
alter table public.reel_views
  add column if not exists last_viewed_at timestamptz not null default now();
create index if not exists reel_views_reel_idx
  on public.reel_views (reel_id, first_viewed_at desc);

alter table public.reel_views enable row level security;
alter table public.reel_views force row level security;
drop policy if exists reel_views_insert_owner on public.reel_views;
drop policy if exists reel_views_read_authenticated on public.reel_views;
drop policy if exists reel_views_update_owner on public.reel_views;
revoke all on table public.reel_views from public, anon, authenticated;

create or replace function public.record_reel_view(p_reel_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  insert into public.reel_views (reel_id, viewer_id, first_viewed_at, last_viewed_at)
  select r.id, auth.uid(), now(), now()
  from public.reels r
  where r.id = p_reel_id
    and r.author_id <> auth.uid()
  on conflict (reel_id, viewer_id)
  do update set last_viewed_at = excluded.last_viewed_at;

  return found;
end;
$$;

create or replace function public.get_my_reel_stats()
returns table (
  reel_id uuid,
  caption text,
  created_at timestamptz,
  duration_seconds numeric,
  view_count bigint,
  like_count bigint,
  comment_count bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    r.id,
    r.caption,
    r.created_at,
    r.duration_seconds,
    (select count(*) from public.reel_views rv where rv.reel_id = r.id)::bigint,
    (select count(*) from public.reel_likes rl where rl.reel_id = r.id)::bigint,
    (select count(*) from public.reel_comments rc where rc.reel_id = r.id)::bigint
  from public.reels r
  where auth.uid() is not null
    and r.author_id = auth.uid()
  order by r.created_at desc;
$$;

revoke all on function public.record_reel_view(uuid) from public, anon;
revoke all on function public.get_my_reel_stats() from public, anon;
grant execute on function public.record_reel_view(uuid) to authenticated;
grant execute on function public.get_my_reel_stats() to authenticated;
