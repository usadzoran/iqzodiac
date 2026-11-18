-- Allow authenticated viewers to read and send messages in public live broadcasts.
drop policy if exists vip_live_chat_read_vip on public.vip_live_chat_messages;
create policy vip_live_chat_read_authenticated on public.vip_live_chat_messages
for select to authenticated
using (
  moderation_status = 'visible'
  and exists (
    select 1 from public.vip_live_sessions s
    where s.id = live_session_id
      and ((s.visibility = 'public' and s.status in ('scheduled', 'live')) or s.host_user_id = auth.uid())
  )
);
grant insert on public.vip_live_chat_messages to authenticated;
drop policy if exists vip_live_chat_insert_authenticated on public.vip_live_chat_messages;
create policy vip_live_chat_insert_authenticated on public.vip_live_chat_messages
for insert to authenticated
with check (
  sender_user_id = auth.uid()
  and exists (
    select 1 from public.vip_live_sessions s
    where s.id = live_session_id
      and ((s.visibility = 'public' and s.status in ('scheduled', 'live')) or s.host_user_id = auth.uid())
  )
);

create or replace function public.iqzodiac_end_live_session(p_live_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  update public.vip_live_sessions
  set status = 'ended', ended_at = now(), updated_at = now()
  where id = p_live_session_id
    and (host_user_id = auth.uid() or public.iqzodiac_vip_has_role('admin'))
    and status in ('scheduled', 'live');
  return found;
end;
$$;
revoke all on function public.iqzodiac_end_live_session(uuid) from public, anon;
grant execute on function public.iqzodiac_end_live_session(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vip_live_chat_messages') then
    alter publication supabase_realtime add table public.vip_live_chat_messages;
  end if;
end $$;
