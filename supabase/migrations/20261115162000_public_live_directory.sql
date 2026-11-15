-- Public broadcast directory rows are readable by authenticated members.
drop policy if exists vip_live_sessions_read_vip on public.vip_live_sessions;
create policy vip_live_sessions_read_vip on public.vip_live_sessions
for select to authenticated
using ((visibility = 'public' and status in ('scheduled', 'live')) or host_user_id = auth.uid());
