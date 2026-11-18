-- Enable the existing LiveKit broadcast flow for authenticated members.
update public.vip_feature_status
set live_streaming_enabled = true,
    updated_at = now()
where singleton = true;

-- Public live directory access is available to authenticated users; private sessions remain host-only.
drop policy if exists vip_live_sessions_read_vip on public.vip_live_sessions;
create policy vip_live_sessions_read_authenticated on public.vip_live_sessions
for select to authenticated
using ((visibility = 'public' and status in ('scheduled', 'live')) or host_user_id = auth.uid());

-- Any authenticated member may create a broadcast. Server-side authentication remains mandatory.
create or replace function public.iqzodiac_create_live_session(
  p_title text, p_description text, p_category text,
  p_visibility text default 'public', p_room_settings jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_id uuid;
  v_visibility text := case when p_visibility = 'private' then 'private' else 'public' end;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not exists (select 1 from public.vip_feature_status where singleton = true and live_streaming_enabled = true) then
    raise exception 'live_streaming_disabled';
  end if;
  insert into public.vip_live_sessions(host_user_id, title, description, category, status, visibility, room_settings)
  values (
    auth.uid(),
    left(trim(coalesce(p_title, '')), 120),
    left(coalesce(p_description, ''), 2000),
    left(trim(coalesce(p_category, 'ترفيه')), 80),
    'scheduled',
    v_visibility,
    jsonb_build_object(
      'max_viewers', greatest(2, least(coalesce((p_room_settings->>'max_viewers')::integer, 100), 10000)),
      'allow_chat', coalesce((p_room_settings->>'allow_chat')::boolean, true),
      'welcome_message', left(coalesce(p_room_settings->>'welcome_message', ''), 180)
    )
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.iqzodiac_create_live_session(text, text, text, text, jsonb) from public, anon;
grant execute on function public.iqzodiac_create_live_session(text, text, text, text, jsonb) to authenticated;
