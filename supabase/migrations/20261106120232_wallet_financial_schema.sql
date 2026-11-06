-- Financial ledger separation applied to the connected Supabase project.
-- Reconstructed in source so a fresh database can build the same additive schema.
-- No provider API keys, wallets, cash earnings, or withdrawal requests are seeded.

alter table public.vip_feature_status
  add column if not exists paid_live_admissions_enabled boolean not null default false,
  add column if not exists minimum_withdrawal_usd numeric(14,2) not null default 0 check (minimum_withdrawal_usd >= 0),
  add column if not exists coin_payment_provider_ready boolean not null default false,
  add column if not exists payout_provider_ready boolean not null default false,
  add column if not exists gift_backend_ready boolean not null default false,
  add column if not exists live_provider_ready boolean not null default false,
  add column if not exists paid_admission_backend_ready boolean not null default false;

alter table public.vip_live_sessions
  add column if not exists admission_coin_price bigint not null default 0 check (admission_coin_price >= 0);

alter table public.vip_coin_packages
  add column if not exists bonus_coins bigint not null default 0 check (bonus_coins >= 0);

create table if not exists public.vip_verified_revenue_events (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references auth.users(id) on delete restrict,
  source_type text not null check (source_type in ('cash_gift', 'cash_paid_live_admission')),
  source_reference text not null check (char_length(trim(source_reference)) between 2 and 255),
  provider_code text check (provider_code is null or char_length(trim(provider_code)) between 2 and 40),
  provider_event_ref text not null unique check (char_length(trim(provider_event_ref)) between 2 and 255),
  recognized_amount_usd numeric(14,2) not null check (recognized_amount_usd > 0),
  currency_code text not null default 'USD' check (currency_code = 'USD'),
  signature_verified boolean not null default false,
  settlement_status text not null default 'pending' check (settlement_status in ('pending', 'available')),
  recognized_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_type, source_reference)
);

create table if not exists public.vip_creator_earnings_usd_ledger (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references auth.users(id) on delete restrict,
  entry_type text not null check (entry_type in ('earning', 'earning_released', 'withdrawal_reserved', 'withdrawal_released', 'withdrawal_completed', 'admin_adjustment')),
  source_type text not null check (source_type in ('cash_gift', 'cash_paid_live_admission', 'withdrawal', 'admin_adjustment')),
  source_event_id uuid references public.vip_verified_revenue_events(id) on delete restrict,
  withdrawal_request_id uuid,
  recognized_gross_usd numeric(14,2) not null default 0 check (recognized_gross_usd >= 0),
  creator_share_percent numeric(5,2) check (creator_share_percent between 0 and 100),
  platform_share_percent numeric(5,2) check (platform_share_percent between 0 and 100),
  creator_share_usd numeric(14,2) not null default 0 check (creator_share_usd >= 0),
  platform_share_usd numeric(14,2) not null default 0 check (platform_share_usd >= 0),
  delta_lifetime_usd numeric(14,2) not null default 0,
  delta_available_usd numeric(14,2) not null default 0,
  delta_pending_usd numeric(14,2) not null default 0,
  delta_reserved_usd numeric(14,2) not null default 0,
  delta_withdrawn_usd numeric(14,2) not null default 0,
  currency_code text not null default 'USD' check (currency_code = 'USD'),
  status text not null check (status in ('pending', 'available', 'reserved', 'released', 'completed', 'adjusted')),
  idempotency_key text not null unique check (char_length(trim(idempotency_key)) between 8 and 200),
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((recognized_gross_usd = 0 and creator_share_usd = 0 and platform_share_usd = 0)
    or round(creator_share_usd + platform_share_usd, 2) = recognized_gross_usd),
  check ((entry_type in ('earning', 'earning_released') and source_event_id is not null)
    or (entry_type in ('withdrawal_reserved', 'withdrawal_released', 'withdrawal_completed') and withdrawal_request_id is not null)
    or entry_type = 'admin_adjustment'),
  check (delta_lifetime_usd <> 0 or delta_available_usd <> 0 or delta_pending_usd <> 0
    or delta_reserved_usd <> 0 or delta_withdrawn_usd <> 0 or recognized_gross_usd > 0)
);

create table if not exists public.vip_creator_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  amount_usd numeric(14,2) not null check (amount_usd > 0),
  reserved_amount_usd numeric(14,2) not null check (reserved_amount_usd >= 0),
  payout_method text not null check (payout_method in ('bank_transfer', 'paypal', 'usdt')),
  status text not null default 'pending' check (status in ('pending', 'under_review', 'approved', 'processing', 'completed', 'rejected')),
  idempotency_key text not null unique check (char_length(trim(idempotency_key)) between 8 and 200),
  provider_transfer_ref text,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 1000),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'rejected' or reserved_amount_usd = amount_usd),
  check (status <> 'completed' or completed_at is not null)
);

alter table public.vip_creator_earnings_usd_ledger
  add constraint vip_creator_earnings_usd_ledger_withdrawal_fk
  foreign key (withdrawal_request_id) references public.vip_creator_withdrawals(id) on delete restrict;

create index if not exists vip_verified_revenue_creator_created_idx
  on public.vip_verified_revenue_events (creator_user_id, created_at desc);
create index if not exists vip_creator_usd_ledger_user_created_idx
  on public.vip_creator_earnings_usd_ledger (creator_user_id, created_at desc);
create index if not exists vip_creator_withdrawals_user_created_idx
  on public.vip_creator_withdrawals (user_id, created_at desc);

alter table public.vip_verified_revenue_events enable row level security;
alter table public.vip_creator_earnings_usd_ledger enable row level security;
alter table public.vip_creator_withdrawals enable row level security;
alter table public.vip_verified_revenue_events force row level security;
alter table public.vip_creator_earnings_usd_ledger force row level security;
alter table public.vip_creator_withdrawals force row level security;

revoke all on public.vip_verified_revenue_events, public.vip_creator_earnings_usd_ledger,
  public.vip_creator_withdrawals from anon, authenticated;
grant select on public.vip_verified_revenue_events, public.vip_creator_earnings_usd_ledger,
  public.vip_creator_withdrawals to authenticated;

create policy vip_verified_revenue_events_read_admin on public.vip_verified_revenue_events
  for select to authenticated using (public.iqzodiac_vip_has_role('admin'));
create policy vip_creator_earnings_usd_ledger_read_self_or_admin on public.vip_creator_earnings_usd_ledger
  for select to authenticated using (creator_user_id = auth.uid() or public.iqzodiac_vip_has_role('admin'));
create policy vip_creator_withdrawals_read_self_or_admin on public.vip_creator_withdrawals
  for select to authenticated using (user_id = auth.uid() or public.iqzodiac_vip_has_role('admin'));

-- Extend the existing explicit feature-status row, preserving every financial switch as false.
update public.vip_feature_status
   set paid_live_admissions_enabled = false,
       coin_payment_provider_ready = false,
       payout_provider_ready = false,
       gift_backend_ready = false,
       live_provider_ready = false,
       paid_admission_backend_ready = false,
       updated_at = now()
 where singleton = true;
