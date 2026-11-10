-- Let either verified site owner or VIP admin inspect inactive gifts and audit history.
drop policy if exists vip_gifts_read_admin_control_center on public.vip_gifts;
create policy vip_gifts_read_admin_control_center on public.vip_gifts for select to authenticated
using (public.iqzodiac_is_admin() or (is_active and public.iqzodiac_vip_has_role('vip')));

drop policy if exists vip_admin_audit_read_admin_control_center on public.vip_admin_audit_log;
create policy vip_admin_audit_read_admin_control_center on public.vip_admin_audit_log for select to authenticated
using (public.iqzodiac_is_admin());
