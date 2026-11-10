-- IQZodiac admin control center: server-enforced moderation and configuration controls.

-- Admin can inspect and moderate first-party content without widening member access.
drop policy if exists posts_admin_read on public.posts;
create policy posts_admin_read on public.posts for select to authenticated using (public.iqzodiac_is_admin());
drop policy if exists posts_admin_update on public.posts;
create policy posts_admin_update on public.posts for update to authenticated using (public.iqzodiac_is_admin()) with check (public.iqzodiac_is_admin());
drop policy if exists posts_admin_delete on public.posts;
create policy posts_admin_delete on public.posts for delete to authenticated using (public.iqzodiac_is_admin());

drop policy if exists comments_admin_read on public.comments;
create policy comments_admin_read on public.comments for select to authenticated using (public.iqzodiac_is_admin());
drop policy if exists comments_admin_update on public.comments;
create policy comments_admin_update on public.comments for update to authenticated using (public.iqzodiac_is_admin()) with check (public.iqzodiac_is_admin());
drop policy if exists comments_admin_delete on public.comments;
create policy comments_admin_delete on public.comments for delete to authenticated using (public.iqzodiac_is_admin());

drop policy if exists reels_admin_update on public.reels;
create policy reels_admin_update on public.reels for update to authenticated using (public.iqzodiac_is_admin()) with check (public.iqzodiac_is_admin());
drop policy if exists reels_admin_delete on public.reels;
create policy reels_admin_delete on public.reels for delete to authenticated using (public.iqzodiac_is_admin());

drop policy if exists reel_comments_admin_read on public.reel_comments;
create policy reel_comments_admin_read on public.reel_comments for select to authenticated using (public.iqzodiac_is_admin());
drop policy if exists reel_comments_admin_delete on public.reel_comments;
create policy reel_comments_admin_delete on public.reel_comments for delete to authenticated using (public.iqzodiac_is_admin());

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated using (public.iqzodiac_is_admin() or auth.uid() = user_id) with check (public.iqzodiac_is_admin() or auth.uid() = user_id);

-- Allow an authenticated admin to remove orphaned media after a moderation deletion.
drop policy if exists iqzodiac_media_admin_delete on storage.objects;
create policy iqzodiac_media_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'iqzodiac-media' and public.iqzodiac_is_admin());

drop policy if exists iqzodiac_media_admin_read on storage.objects;
create policy iqzodiac_media_admin_read on storage.objects for select to authenticated using (bucket_id = 'iqzodiac-media' and public.iqzodiac_is_admin());

create or replace function public.iqzodiac_admin_audit(p_action_code text, p_entity_type text, p_entity_id uuid default null, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.iqzodiac_is_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  insert into public.vip_admin_audit_log(actor_user_id, action_code, entity_type, entity_id, metadata)
  values (auth.uid(), left(trim(p_action_code), 120), left(trim(p_entity_type), 120), p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;
revoke all on function public.iqzodiac_admin_audit(text, text, uuid, jsonb) from public, anon;
grant execute on function public.iqzodiac_admin_audit(text, text, uuid, jsonb) to authenticated;

create or replace function public.iqzodiac_admin_update_feature_status(p_live_streaming_enabled boolean, p_coin_purchases_enabled boolean, p_gift_sending_enabled boolean, p_payouts_enabled boolean, p_paid_live_admissions_enabled boolean, p_minimum_withdrawal_usd numeric, p_coin_payment_provider_ready boolean, p_payout_provider_ready boolean, p_gift_backend_ready boolean, p_live_provider_ready boolean, p_paid_admission_backend_ready boolean)
returns public.vip_feature_status
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v public.vip_feature_status;
begin
  if not public.iqzodiac_is_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  update public.vip_feature_status set
    live_streaming_enabled = coalesce(p_live_streaming_enabled, false), coin_purchases_enabled = coalesce(p_coin_purchases_enabled, false),
    gift_sending_enabled = coalesce(p_gift_sending_enabled, false), payouts_enabled = coalesce(p_payouts_enabled, false),
    paid_live_admissions_enabled = coalesce(p_paid_live_admissions_enabled, false), minimum_withdrawal_usd = greatest(coalesce(p_minimum_withdrawal_usd, 0), 0),
    coin_payment_provider_ready = coalesce(p_coin_payment_provider_ready, false), payout_provider_ready = coalesce(p_payout_provider_ready, false),
    gift_backend_ready = coalesce(p_gift_backend_ready, false), live_provider_ready = coalesce(p_live_provider_ready, false),
    paid_admission_backend_ready = coalesce(p_paid_admission_backend_ready, false), updated_at = now()
  where singleton = true returning * into v;
  perform public.iqzodiac_admin_audit('update_feature_status', 'vip_feature_status', null, to_jsonb(v));
  return v;
end;
$$;
revoke all on function public.iqzodiac_admin_update_feature_status(boolean, boolean, boolean, boolean, boolean, numeric, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.iqzodiac_admin_update_feature_status(boolean, boolean, boolean, boolean, boolean, numeric, boolean, boolean, boolean, boolean, boolean) to authenticated;

create or replace function public.iqzodiac_admin_update_gift(p_gift_id uuid, p_name_en text, p_name_ar text, p_price_coins bigint, p_is_active boolean, p_sort_order integer)
returns public.vip_gifts
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v public.vip_gifts;
begin
  if not public.iqzodiac_is_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  update public.vip_gifts set name_en = left(trim(p_name_en), 120), name_ar = left(trim(p_name_ar), 120),
    name = left(coalesce(nullif(trim(p_name_en), ''), nullif(trim(p_name_ar), ''), name), 120),
    price_coins = greatest(coalesce(p_price_coins, 1), 1), is_active = coalesce(p_is_active, false), sort_order = coalesce(p_sort_order, 0), updated_at = now()
  where id = p_gift_id returning * into v;
  if v.id is null then raise exception 'gift_not_found'; end if;
  perform public.iqzodiac_admin_audit('update_gift', 'vip_gifts', v.id, jsonb_build_object('is_active', v.is_active, 'price_coins', v.price_coins));
  return v;
end;
$$;
revoke all on function public.iqzodiac_admin_update_gift(uuid, text, text, bigint, boolean, integer) from public, anon;
grant execute on function public.iqzodiac_admin_update_gift(uuid, text, text, bigint, boolean, integer) to authenticated;
drop policy if exists vip_gifts_read_admin_control_center on public.vip_gifts;
create policy vip_gifts_read_admin_control_center on public.vip_gifts for select to authenticated using (public.iqzodiac_is_admin() or (is_active and public.iqzodiac_vip_has_role('vip')));
drop policy if exists vip_admin_audit_read_admin_control_center on public.vip_admin_audit_log;
create policy vip_admin_audit_read_admin_control_center on public.vip_admin_audit_log for select to authenticated using (public.iqzodiac_is_admin());
