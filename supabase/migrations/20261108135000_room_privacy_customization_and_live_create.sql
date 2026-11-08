-- Room customization and creator-controlled visibility.
alter table public.audio_rooms add column if not exists visibility text not null default 'public' check (visibility in ('public', 'private'));
alter table public.audio_rooms add column if not exists room_settings jsonb not null default '{}'::jsonb;

 drop policy if exists audio_rooms_read_open on public.audio_rooms;
create policy audio_rooms_read_open on public.audio_rooms for select to authenticated
using ((status = 'open' and visibility = 'public') or host_user_id = auth.uid());

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
  return v_id;
end;
$$;
revoke all on function public.iqzodiac_create_audio_room(text, text, text) from public, anon;
revoke all on function public.iqzodiac_create_audio_room(text, text, text, text, jsonb) from public, anon;
grant execute on function public.iqzodiac_create_audio_room(text, text, text, text, jsonb) to authenticated;

alter table public.vip_live_sessions add column if not exists visibility text not null default 'public' check (visibility in ('public', 'private'));
alter table public.vip_live_sessions add column if not exists room_settings jsonb not null default '{}'::jsonb;

drop policy if exists vip_live_sessions_read_vip on public.vip_live_sessions;
create policy vip_live_sessions_read_vip on public.vip_live_sessions for select to authenticated
using ((visibility = 'public' and (public.iqzodiac_vip_has_role('vip') or public.iqzodiac_vip_has_role('admin'))) or host_user_id = auth.uid());

grant insert on public.vip_live_sessions to authenticated;
create or replace function public.iqzodiac_create_live_session(
  p_title text, p_description text, p_category text,
  p_visibility text default 'public', p_room_settings jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_id uuid; v_visibility text := case when p_visibility = 'private' then 'private' else 'public' end;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not (public.iqzodiac_vip_has_role('vip') or public.iqzodiac_vip_has_role('host') or public.iqzodiac_vip_has_role('admin')) then raise exception 'live_host_role_required'; end if;
  insert into public.vip_live_sessions(host_user_id, title, description, category, status, visibility, room_settings)
  values (auth.uid(), trim(p_title), left(coalesce(p_description, ''), 2000), left(trim(coalesce(p_category, 'ترفيه')), 80), 'scheduled', v_visibility,
    jsonb_build_object('max_viewers', greatest(2, least(coalesce((p_room_settings->>'max_viewers')::integer, 100), 10000)), 'allow_chat', coalesce((p_room_settings->>'allow_chat')::boolean, true), 'welcome_message', left(coalesce(p_room_settings->>'welcome_message', ''), 180)))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.iqzodiac_create_live_session(text, text, text, text, jsonb) from public, anon;
grant execute on function public.iqzodiac_create_live_session(text, text, text, text, jsonb) to authenticated;
