create or replace function public.iqzodiac_start_live_session(p_live_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  update public.vip_live_sessions
  set status = 'live', started_at = coalesce(started_at, now()), updated_at = now()
  where id = p_live_session_id
    and host_user_id = auth.uid()
    and status in ('scheduled', 'live');
  return found;
end;
$$;
revoke all on function public.iqzodiac_start_live_session(uuid) from public, anon;
grant execute on function public.iqzodiac_start_live_session(uuid) to authenticated;
