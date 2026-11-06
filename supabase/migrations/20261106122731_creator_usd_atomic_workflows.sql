-- Creator USD ledger workflows. Coins are never converted into cash by this migration.
-- Provider credentials and provider API configuration are intentionally absent.
-- All provider-backed features remain fail-closed until separately configured and enabled.

create or replace view public.vip_creator_usd_balances
with (security_invoker = true)
as
select
  creator_user_id,
  coalesce(sum(delta_lifetime_usd), 0)::numeric(14,2) as lifetime_usd,
  coalesce(sum(delta_available_usd), 0)::numeric(14,2) as available_usd,
  coalesce(sum(delta_pending_usd), 0)::numeric(14,2) as pending_usd,
  coalesce(sum(delta_reserved_usd), 0)::numeric(14,2) as reserved_usd,
  coalesce(sum(delta_withdrawn_usd), 0)::numeric(14,2) as withdrawn_usd
from public.vip_creator_earnings_usd_ledger
group by creator_user_id;

revoke all on public.vip_creator_usd_balances from anon, public;
grant select on public.vip_creator_usd_balances to authenticated;

create or replace function public.iqzodiac_record_verified_creator_revenue(
  p_creator_user_id uuid,
  p_source_type text,
  p_source_reference text,
  p_provider_code text,
  p_provider_event_ref text,
  p_recognized_amount_usd numeric,
  p_settlement_status text,
  p_idempotency_key text,
  p_signature_verified boolean
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_feature record;
  v_existing_event public.vip_verified_revenue_events%rowtype;
  v_existing_ledger record;
  v_event_id uuid;
  v_ledger_id uuid;
  v_creator_share_percent numeric(5,2);
  v_platform_share_percent numeric(5,2);
  v_creator_share numeric(14,2);
  v_platform_share numeric(14,2);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_creator_user_id is null
    or p_source_type is null or p_source_type not in ('cash_gift', 'cash_paid_live_admission')
    or p_source_reference is null or char_length(trim(p_source_reference)) not between 2 and 255
    or p_provider_code is null or char_length(trim(p_provider_code)) not between 2 and 40
    or p_provider_event_ref is null or char_length(trim(p_provider_event_ref)) not between 2 and 255
    or p_recognized_amount_usd is null or p_recognized_amount_usd <= 0
    or p_recognized_amount_usd <> round(p_recognized_amount_usd, 2)
    or p_settlement_status is null or p_settlement_status not in ('pending', 'available')
    or p_idempotency_key is null or char_length(trim(p_idempotency_key)) not between 8 and 200
    or p_signature_verified is distinct from true then
    raise exception 'invalid_or_unverified_revenue_event' using errcode = '22023';
  end if;

  select live_streaming_enabled, gift_sending_enabled, paid_live_admissions_enabled,
         live_provider_ready, gift_backend_ready, paid_admission_backend_ready
    into v_feature
    from public.vip_feature_status
   where singleton = true;

  if p_source_type = 'cash_gift' and not (
    coalesce(v_feature.live_streaming_enabled, false)
    and coalesce(v_feature.gift_sending_enabled, false)
    and coalesce(v_feature.live_provider_ready, false)
    and coalesce(v_feature.gift_backend_ready, false)
  ) then
    raise exception 'cash_gift_provider_not_ready' using errcode = '55000';
  end if;
  if p_source_type = 'cash_paid_live_admission' and not (
    coalesce(v_feature.live_streaming_enabled, false)
    and coalesce(v_feature.paid_live_admissions_enabled, false)
    and coalesce(v_feature.live_provider_ready, false)
    and coalesce(v_feature.paid_admission_backend_ready, false)
  ) then
    raise exception 'paid_admission_provider_not_ready' using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

  select l.id, l.creator_user_id, l.source_type, l.recognized_gross_usd,
         e.source_reference, e.provider_event_ref
    into v_existing_ledger
    from public.vip_creator_earnings_usd_ledger l
    left join public.vip_verified_revenue_events e on e.id = l.source_event_id
   where l.idempotency_key = p_idempotency_key
   limit 1;
  if found then
    if v_existing_ledger.creator_user_id <> p_creator_user_id
      or v_existing_ledger.source_type <> p_source_type
      or v_existing_ledger.source_reference <> trim(p_source_reference)
      or v_existing_ledger.provider_event_ref <> trim(p_provider_event_ref)
      or v_existing_ledger.recognized_gross_usd <> p_recognized_amount_usd then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return v_existing_ledger.id;
  end if;

  select * into v_existing_event
    from public.vip_verified_revenue_events
   where provider_event_ref = trim(p_provider_event_ref)
      or (source_type = p_source_type and source_reference = trim(p_source_reference))
   limit 1;
  if found then
    if v_existing_event.creator_user_id <> p_creator_user_id
      or v_existing_event.source_type <> p_source_type
      or v_existing_event.source_reference <> trim(p_source_reference)
      or v_existing_event.provider_event_ref <> trim(p_provider_event_ref)
      or v_existing_event.recognized_amount_usd <> p_recognized_amount_usd then
      raise exception 'revenue_event_conflict' using errcode = '23505';
    end if;
    select id into v_ledger_id
      from public.vip_creator_earnings_usd_ledger
     where source_event_id = v_existing_event.id
     limit 1;
    if v_ledger_id is not null then
      return v_ledger_id;
    end if;
    raise exception 'revenue_event_already_recorded_without_ledger' using errcode = '55000';
  end if;

  select creator_share_percent, platform_share_percent
    into v_creator_share_percent, v_platform_share_percent
    from public.vip_revenue_share_settings
   where is_active = true
   order by effective_at desc, created_at desc
   limit 1;
  if not found then
    raise exception 'active_revenue_share_rule_missing' using errcode = '55000';
  end if;

  v_creator_share := round(p_recognized_amount_usd * v_creator_share_percent / 100, 2);
  v_platform_share := p_recognized_amount_usd - v_creator_share;

  insert into public.vip_verified_revenue_events (
    creator_user_id, source_type, source_reference, provider_code, provider_event_ref,
    recognized_amount_usd, currency_code, signature_verified, settlement_status, processed_at
  ) values (
    p_creator_user_id, p_source_type, trim(p_source_reference), trim(p_provider_code),
    trim(p_provider_event_ref), p_recognized_amount_usd, 'USD', true, p_settlement_status, now()
  ) returning id into v_event_id;

  insert into public.vip_creator_earnings_usd_ledger (
    creator_user_id, entry_type, source_type, source_event_id,
    recognized_gross_usd, creator_share_percent, platform_share_percent,
    creator_share_usd, platform_share_usd,
    delta_lifetime_usd, delta_available_usd, delta_pending_usd,
    currency_code, status, idempotency_key, actor_user_id
  ) values (
    p_creator_user_id, 'earning', p_source_type, v_event_id,
    p_recognized_amount_usd, v_creator_share_percent, v_platform_share_percent,
    v_creator_share, v_platform_share,
    v_creator_share,
    case when p_settlement_status = 'available' then v_creator_share else 0 end,
    case when p_settlement_status = 'pending' then v_creator_share else 0 end,
    'USD', p_settlement_status, p_idempotency_key, null
  ) returning id into v_ledger_id;

  return v_ledger_id;
end;
$$;

revoke all on function public.iqzodiac_record_verified_creator_revenue(uuid, text, text, text, text, numeric, text, text, boolean) from public, anon, authenticated;
grant execute on function public.iqzodiac_record_verified_creator_revenue(uuid, text, text, text, text, numeric, text, text, boolean) to service_role;

create or replace function public.iqzodiac_request_creator_withdrawal_usd(
  p_amount_usd numeric,
  p_payout_method text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.vip_creator_withdrawals%rowtype;
  v_request_id uuid;
  v_available numeric(14,2);
  v_minimum numeric(14,2);
  v_enabled boolean;
  v_provider_ready boolean;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_amount_usd is null or p_amount_usd <= 0 or p_amount_usd <> round(p_amount_usd, 2)
    or p_payout_method not in ('bank_transfer', 'paypal', 'usdt')
    or p_idempotency_key is null or char_length(trim(p_idempotency_key)) not between 8 and 180 then
    raise exception 'invalid_withdrawal_request' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select * into v_existing
    from public.vip_creator_withdrawals
   where idempotency_key = trim(p_idempotency_key)
   limit 1;
  if found then
    if v_existing.user_id <> v_user_id
      or v_existing.amount_usd <> p_amount_usd
      or v_existing.payout_method <> p_payout_method then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return v_existing.id;
  end if;

  select payouts_enabled, payout_provider_ready, minimum_withdrawal_usd
    into v_enabled, v_provider_ready, v_minimum
    from public.vip_feature_status
   where singleton = true;
  if not coalesce(v_enabled, false) or not coalesce(v_provider_ready, false) then
    raise exception 'payouts_not_ready' using errcode = '55000';
  end if;
  if p_amount_usd < coalesce(v_minimum, 0) then
    raise exception 'below_minimum_withdrawal' using errcode = '22023';
  end if;

  select coalesce(sum(delta_available_usd), 0)::numeric(14,2)
    into v_available
    from public.vip_creator_earnings_usd_ledger
   where creator_user_id = v_user_id;
  if v_available < p_amount_usd then
    raise exception 'insufficient_available_usd' using errcode = '22023';
  end if;

  insert into public.vip_creator_withdrawals (
    user_id, amount_usd, reserved_amount_usd, payout_method, status, idempotency_key
  ) values (
    v_user_id, p_amount_usd, p_amount_usd, p_payout_method, 'pending', trim(p_idempotency_key)
  ) returning id into v_request_id;

  insert into public.vip_creator_earnings_usd_ledger (
    creator_user_id, entry_type, source_type, withdrawal_request_id,
    delta_available_usd, delta_reserved_usd, currency_code, status, idempotency_key, actor_user_id
  ) values (
    v_user_id, 'withdrawal_reserved', 'withdrawal', v_request_id,
    -p_amount_usd, p_amount_usd, 'USD', 'reserved', 'withdrawal-reserve:' || v_request_id::text, v_user_id
  );

  return v_request_id;
end;
$$;

revoke all on function public.iqzodiac_request_creator_withdrawal_usd(numeric, text, text) from public, anon;
grant execute on function public.iqzodiac_request_creator_withdrawal_usd(numeric, text, text) to authenticated;

comment on function public.iqzodiac_record_verified_creator_revenue(uuid, text, text, text, text, numeric, text, text, boolean) is
  'Service-role only. Records verified cash revenue atomically; never derives USD from coin gift transactions. Requires matching live/gift readiness flags.';
comment on function public.iqzodiac_request_creator_withdrawal_usd(numeric, text, text) is
  'Atomically reserves available USD with per-user locking and idempotency. Fails closed until payouts and a payout provider are ready.';
