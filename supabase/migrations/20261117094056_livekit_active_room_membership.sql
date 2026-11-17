-- Keep room membership changes behind the trusted RPC and do not let a removed
-- member undo a moderator's removal by calling the public join RPC again.
create or replace function public.iqzodiac_join_audio_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_room public.audio_rooms%rowtype;
  v_last_moderation_action text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select * into v_room
  from public.audio_rooms
  where id = p_room_id and status = 'open';
  if not found then
    raise exception 'room_not_open';
  end if;

  select action_code into v_last_moderation_action
  from public.audio_room_moderation_actions
  where room_id = p_room_id
    and target_user_id = auth.uid()
    and action_code in ('remove', 'restore')
  order by created_at desc, id desc
  limit 1;

  if v_last_moderation_action = 'remove' then
    raise exception 'member_removed';
  end if;

  if v_room.visibility = 'private'
     and v_room.host_user_id <> auth.uid()
     and not exists (
       select 1
       from public.audio_room_members
       where room_id = p_room_id
         and user_id = auth.uid()
         and removed_at is null
     ) then
    raise exception 'private_room_access_required';
  end if;

  insert into public.audio_room_members(room_id, user_id, role, removed_at)
  values (
    p_room_id,
    auth.uid(),
    case when v_room.host_user_id = auth.uid() then 'host' else 'member' end,
    null
  )
  on conflict (room_id, user_id)
  do update set removed_at = null, updated_at = now();
end;
$$;

revoke all on function public.iqzodiac_join_audio_room(uuid) from public, anon;
grant execute on function public.iqzodiac_join_audio_room(uuid) to authenticated;
