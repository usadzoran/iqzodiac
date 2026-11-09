-- Audio-room membership and host-controlled moderation.
create table if not exists public.audio_room_members (
  room_id uuid not null references public.audio_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('host', 'moderator', 'member')),
  is_muted boolean not null default false,
  removed_at timestamptz,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.audio_room_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.audio_rooms(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  action_code text not null check (action_code in ('mute', 'unmute', 'remove', 'restore', 'appoint_moderator', 'remove_moderator')),
  created_at timestamptz not null default now(),
  constraint audio_room_action_distinct_users check (actor_user_id <> target_user_id)
);

create index if not exists audio_room_members_user_idx on public.audio_room_members(user_id, joined_at desc);
create index if not exists audio_room_members_room_role_idx on public.audio_room_members(room_id, role, joined_at);
create index if not exists audio_room_actions_room_idx on public.audio_room_moderation_actions(room_id, created_at desc);

alter table public.audio_room_members enable row level security;
alter table public.audio_room_members force row level security;
alter table public.audio_room_moderation_actions enable row level security;
alter table public.audio_room_moderation_actions force row level security;
revoke all on public.audio_room_members, public.audio_room_moderation_actions from anon, authenticated;
grant select on public.audio_room_members to authenticated;
grant execute on function public.iqzodiac_create_audio_room(text, text, text, text, jsonb) to authenticated;

drop policy if exists audio_room_members_read_participant_or_host on public.audio_room_members;
create policy audio_room_members_read_participant_or_host on public.audio_room_members
for select to authenticated using (
  user_id = auth.uid() or exists (
    select 1 from public.audio_room_members own
    where own.room_id = audio_room_members.room_id
      and own.user_id = auth.uid()
      and own.role in ('host', 'moderator')
      and own.removed_at is null
  )
);

drop policy if exists audio_room_actions_read_moderators on public.audio_room_moderation_actions;
create policy audio_room_actions_read_moderators on public.audio_room_moderation_actions
for select to authenticated using (exists (
  select 1 from public.audio_room_members own
  where own.room_id = audio_room_moderation_actions.room_id
    and own.user_id = auth.uid()
    and own.role in ('host', 'moderator')
    and own.removed_at is null
));

create or replace function public.iqzodiac_create_audio_room(
  p_title text, p_description text, p_category text,
  p_visibility text default 'public', p_room_settings jsonb default '{}'::jsonb
)
returns uuid language plpgsql security invoker set search_path = public
as $$
declare v_id uuid; v_visibility text := case when p_visibility = 'private' then 'private' else 'public' end;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  insert into public.audio_rooms(host_user_id, title, description, category, visibility, room_settings)
  values (auth.uid(), trim(p_title), left(coalesce(p_description, ''), 500), left(trim(coalesce(p_category, 'ترفيه')), 80), v_visibility,
    jsonb_build_object('max_listeners', greatest(2, least(coalesce((p_room_settings->>'max_listeners')::integer, 50), 500)), 'allow_chat', coalesce((p_room_settings->>'allow_chat')::boolean, true), 'welcome_message', left(coalesce(p_room_settings->>'welcome_message', ''), 180)))
  returning id into v_id;
  insert into public.audio_room_members(room_id, user_id, role) values (v_id, auth.uid(), 'host');
  return v_id;
end;
$$;

create or replace function public.iqzodiac_join_audio_room(p_room_id uuid)
returns void language plpgsql security invoker set search_path = public
as $$
declare v_room public.audio_rooms%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into v_room from public.audio_rooms where id = p_room_id and status = 'open';
  if not found then raise exception 'room_not_open'; end if;
  if v_room.visibility = 'private' and not exists (select 1 from public.audio_room_members where room_id = p_room_id and user_id = auth.uid() and removed_at is null) then raise exception 'private_room_access_required'; end if;
  insert into public.audio_room_members(room_id, user_id, role, removed_at) values (p_room_id, auth.uid(), 'member', null)
  on conflict (room_id, user_id) do update set removed_at = null, updated_at = now();
end;
$$;

create or replace function public.iqzodiac_leave_audio_room(p_room_id uuid)
returns void language plpgsql security invoker set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  update public.audio_room_members set removed_at = now(), updated_at = now() where room_id = p_room_id and user_id = auth.uid() and role <> 'host';
end;
$$;

create or replace function public.iqzodiac_moderate_audio_room(p_room_id uuid, p_target_user_id uuid, p_action text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_actor_role text; v_target_role text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_target_user_id = auth.uid() then raise exception 'cannot_moderate_self'; end if;
  select role into v_actor_role from public.audio_room_members where room_id = p_room_id and user_id = auth.uid() and removed_at is null;
  if v_actor_role is null or v_actor_role not in ('host', 'moderator') then raise exception 'moderator_required'; end if;
  select role into v_target_role from public.audio_room_members where room_id = p_room_id and user_id = p_target_user_id;
  if v_target_role is null then raise exception 'member_not_found'; end if;
  if p_action in ('appoint_moderator', 'remove_moderator') and v_actor_role <> 'host' then raise exception 'host_required'; end if;
  if v_target_role = 'host' then raise exception 'cannot_moderate_host'; end if;
  if p_action = 'mute' then update public.audio_room_members set is_muted = true, updated_at = now() where room_id = p_room_id and user_id = p_target_user_id;
  elsif p_action = 'unmute' then update public.audio_room_members set is_muted = false, updated_at = now() where room_id = p_room_id and user_id = p_target_user_id;
  elsif p_action = 'remove' then update public.audio_room_members set removed_at = now(), updated_at = now() where room_id = p_room_id and user_id = p_target_user_id;
  elsif p_action = 'restore' then update public.audio_room_members set removed_at = null, updated_at = now() where room_id = p_room_id and user_id = p_target_user_id;
  elsif p_action = 'appoint_moderator' then update public.audio_room_members set role = 'moderator', updated_at = now() where room_id = p_room_id and user_id = p_target_user_id;
  elsif p_action = 'remove_moderator' then update public.audio_room_members set role = 'member', updated_at = now() where room_id = p_room_id and user_id = p_target_user_id;
  else raise exception 'unsupported_moderation_action'; end if;
  insert into public.audio_room_moderation_actions(room_id, actor_user_id, target_user_id, action_code) values (p_room_id, auth.uid(), p_target_user_id, p_action);
end;
$$;

revoke all on function public.iqzodiac_join_audio_room(uuid), public.iqzodiac_leave_audio_room(uuid), public.iqzodiac_moderate_audio_room(uuid, uuid, text) from public, anon;
grant execute on function public.iqzodiac_join_audio_room(uuid), public.iqzodiac_leave_audio_room(uuid), public.iqzodiac_moderate_audio_room(uuid, uuid, text) to authenticated;
