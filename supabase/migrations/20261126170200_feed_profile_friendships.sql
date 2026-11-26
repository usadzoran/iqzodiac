-- Feed profile likes and accepted friendships are separate from Match likes/matches.
-- Profile details are exposed only through bounded authenticated RPCs.

create table if not exists public.friendships (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_a, user_b),
  constraint friendships_ordered_pair check (user_a < user_b),
  constraint friendships_requester_in_pair check (requested_by in (user_a, user_b)),
  constraint friendships_status_check check (status in ('pending', 'accepted', 'declined')),
  constraint friendships_response_state_check check (
    (status = 'pending' and responded_at is null)
    or (status in ('accepted', 'declined') and responded_at is not null)
  )
);

alter table public.friendships enable row level security;
alter table public.friendships force row level security;
revoke all on table public.friendships from public, anon, authenticated;
create index if not exists friendships_user_a_state_idx on public.friendships (user_a, status, requested_at desc);
create index if not exists friendships_user_b_state_idx on public.friendships (user_b, status, requested_at desc);

alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
  check (notification_type in ('post_like', 'post_comment', 'private_message', 'profile_like', 'profile_follow', 'comment_reply', 'reel_like', 'reel_comment', 'friend_request')) not valid;

create or replace function public.iqzodiac_create_feed_profile_like_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  actor_name text;
begin
  select coalesce(nullif(btrim(p.display_name), ''), 'An IQZodiac member')
    into actor_name
    from public.profiles p
   where p.user_id = new.liker_id;

  insert into public.notifications (recipient_id, actor_id, notification_type, message)
  values (new.liked_user_id, new.liker_id, 'profile_like', coalesce(actor_name, 'An IQZodiac member') || ' liked your profile.');
  return new;
end;
$$;
revoke all on function public.iqzodiac_create_feed_profile_like_notification() from public, anon, authenticated;
drop trigger if exists feed_profile_like_notification_trigger on public.profile_likes;
create trigger feed_profile_like_notification_trigger
after insert on public.profile_likes
for each row execute function public.iqzodiac_create_feed_profile_like_notification();

create or replace function public.iqzodiac_create_friend_request_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  recipient uuid;
  actor_name text;
begin
  if new.status <> 'pending' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'pending' and old.requested_by = new.requested_by then
    return new;
  end if;

  recipient := case when new.requested_by = new.user_a then new.user_b else new.user_a end;
  select coalesce(nullif(btrim(p.display_name), ''), 'An IQZodiac member')
    into actor_name
    from public.profiles p
   where p.user_id = new.requested_by;

  insert into public.notifications (recipient_id, actor_id, notification_type, message)
  values (recipient, new.requested_by, 'friend_request', coalesce(actor_name, 'An IQZodiac member') || ' sent you a friend request.');
  return new;
end;
$$;
revoke all on function public.iqzodiac_create_friend_request_notification() from public, anon, authenticated;
drop trigger if exists friendship_request_notification_trigger on public.friendships;
create trigger friendship_request_notification_trigger
after insert or update of status, requested_by on public.friendships
for each row execute function public.iqzodiac_create_friend_request_notification();

create or replace function public.get_feed_profile_card(p_user_id uuid)
returns table (
  user_id uuid,
  display_name text,
  handle text,
  interests text[],
  liked_by_me boolean,
  friendship_status text,
  is_online boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select p.user_id,
         p.display_name,
         p.handle,
         case
           when dp.discovery_status = 'completed' and dp.discoverable = true and dp.completed_at is not null
             then coalesce(dp.interests, array[]::text[])
           else array[]::text[]
         end as interests,
         exists (
           select 1 from public.profile_likes pl
            where pl.liker_id = auth.uid() and pl.liked_user_id = p.user_id
         ) as liked_by_me,
         case
           when f.status = 'accepted' then 'friends'
           when f.status = 'pending' and f.requested_by = auth.uid() then 'outgoing_pending'
           when f.status = 'pending' then 'incoming_pending'
           when f.status = 'declined' and f.requested_by = auth.uid() then 'declined'
           else 'none'
         end as friendship_status,
         case
           when f.status = 'accepted' then coalesce(pres.last_seen_at >= now() - interval '75 seconds', false)
           else null::boolean
         end as is_online
    from public.profiles p
    left join public.discovery_profiles dp on dp.user_id = p.user_id
    left join public.friendships f
      on f.user_a = least(auth.uid(), p.user_id)
     and f.user_b = greatest(auth.uid(), p.user_id)
    left join public.match_presence pres on pres.user_id = p.user_id
   where auth.uid() is not null
     and p_user_id is not null
     and p.user_id = p_user_id
     and p.user_id <> auth.uid()
     and lower(coalesce(p.privacy->>'publicIdentity', 'pseudonym')) in ('pseudonym', 'public', 'publicname');
$$;
revoke all on function public.get_feed_profile_card(uuid) from public, anon;
grant execute on function public.get_feed_profile_card(uuid) to authenticated;

create or replace function public.toggle_feed_profile_like(p_target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or p_target_user_id is null or p_target_user_id = actor then
    raise exception 'invalid_profile_like_target';
  end if;
  if not exists (
    select 1 from public.profiles p
     where p.user_id = p_target_user_id
       and lower(coalesce(p.privacy->>'publicIdentity', 'pseudonym')) in ('pseudonym', 'public', 'publicname')
  ) then
    raise exception 'profile_not_available';
  end if;

  if exists (select 1 from public.profile_likes pl where pl.liker_id = actor and pl.liked_user_id = p_target_user_id) then
    delete from public.profile_likes pl where pl.liker_id = actor and pl.liked_user_id = p_target_user_id;
    return false;
  end if;

  insert into public.profile_likes (liker_id, liked_user_id)
  values (actor, p_target_user_id)
  on conflict (user_id, target_user_id) do nothing;
  return true;
end;
$$;
revoke all on function public.toggle_feed_profile_like(uuid) from public, anon;
grant execute on function public.toggle_feed_profile_like(uuid) to authenticated;

create or replace function public.request_friend(p_target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  actor uuid := auth.uid();
  pair_a uuid;
  pair_b uuid;
  current_status text;
  current_requester uuid;
begin
  if actor is null or p_target_user_id is null or p_target_user_id = actor then
    raise exception 'invalid_friend_target';
  end if;
  if not exists (
    select 1 from public.profiles p
     where p.user_id = p_target_user_id
       and lower(coalesce(p.privacy->>'publicIdentity', 'pseudonym')) in ('pseudonym', 'public', 'publicname')
  ) then
    raise exception 'profile_not_available';
  end if;

  pair_a := least(actor, p_target_user_id);
  pair_b := greatest(actor, p_target_user_id);
  insert into public.friendships (user_a, user_b, requested_by, status, requested_at, responded_at, updated_at)
  values (pair_a, pair_b, actor, 'pending', now(), null, now())
  on conflict (user_a, user_b) do nothing;

  select f.status, f.requested_by into current_status, current_requester
    from public.friendships f
   where f.user_a = pair_a and f.user_b = pair_b
   for update;

  if current_status = 'accepted' then return 'friends'; end if;
  if current_status = 'pending' then
    return case when current_requester = actor then 'outgoing_pending' else 'incoming_pending' end;
  end if;

  update public.friendships
     set requested_by = actor, status = 'pending', requested_at = now(), responded_at = null, updated_at = now()
   where user_a = pair_a and user_b = pair_b;
  return 'outgoing_pending';
end;
$$;
revoke all on function public.request_friend(uuid) from public, anon;
grant execute on function public.request_friend(uuid) to authenticated;

create or replace function public.respond_friend_request(p_target_user_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  actor uuid := auth.uid();
  pair_a uuid;
  pair_b uuid;
  current_status text;
  current_requester uuid;
begin
  if actor is null or p_target_user_id is null or p_target_user_id = actor or p_accept is null then
    raise exception 'invalid_friend_request_response';
  end if;
  pair_a := least(actor, p_target_user_id);
  pair_b := greatest(actor, p_target_user_id);

  select f.status, f.requested_by into current_status, current_requester
    from public.friendships f
   where f.user_a = pair_a and f.user_b = pair_b
   for update;
  if current_status is distinct from 'pending' or current_requester = actor then
    raise exception 'friend_request_not_pending_for_recipient';
  end if;

  update public.friendships
     set status = case when p_accept then 'accepted' else 'declined' end,
         responded_at = now(), updated_at = now()
   where user_a = pair_a and user_b = pair_b;
  return case when p_accept then 'friends' else 'declined' end;
end;
$$;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

create or replace function public.get_my_friend_requests()
returns table (user_id uuid, display_name text, handle text, requested_at timestamptz)
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select p.user_id, p.display_name, p.handle, f.requested_at
    from public.friendships f
    join public.profiles p
      on p.user_id = case when f.requested_by = f.user_a then f.user_b else f.user_a end
   where auth.uid() is not null
     and f.status = 'pending'
     and f.requested_by <> auth.uid()
     and auth.uid() in (f.user_a, f.user_b)
     and lower(coalesce(p.privacy->>'publicIdentity', 'pseudonym')) in ('pseudonym', 'public', 'publicname')
   order by f.requested_at desc
   limit 50;
$$;
revoke all on function public.get_my_friend_requests() from public, anon;
grant execute on function public.get_my_friend_requests() to authenticated;

create or replace function public.get_my_friends()
returns table (user_id uuid, display_name text, handle text, is_online boolean)
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select p.user_id, p.display_name, p.handle,
         coalesce(pres.last_seen_at >= now() - interval '75 seconds', false) as is_online
    from public.friendships f
    join public.profiles p
      on p.user_id = case when f.user_a = auth.uid() then f.user_b else f.user_a end
    left join public.match_presence pres on pres.user_id = p.user_id
   where auth.uid() is not null
     and f.status = 'accepted'
     and auth.uid() in (f.user_a, f.user_b)
     and lower(coalesce(p.privacy->>'publicIdentity', 'pseudonym')) in ('pseudonym', 'public', 'publicname')
   order by lower(p.display_name), p.user_id
   limit 100;
$$;
revoke all on function public.get_my_friends() from public, anon;
grant execute on function public.get_my_friends() to authenticated;
