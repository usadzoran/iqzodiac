-- IQZodiac VIP live, wallet, gifts and moderation foundation.
-- Additive only: no existing object is dropped, replaced, or altered.
-- No balances, payment records, gift transactions, viewers, or live sessions are seeded.
-- Provider credentials must never be stored in these tables.

create table if not exists public.vip_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('vip', 'host', 'moderator', 'admin')),
  is_active boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.vip_live_sessions (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'ended', 'cancelled', 'suspended')),
  stream_provider text,
  provider_session_ref text,
  viewer_count integer check (viewer_count is null or viewer_count >= 0),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or (started_at is not null and ended_at >= started_at))
);

create table if not exists public.vip_live_chat_messages (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.vip_live_sessions(id) on delete restrict,
  sender_user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  moderation_status text not null default 'visible'
    check (moderation_status in ('visible', 'hidden', 'removed')),
  moderated_by uuid references auth.users(id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.vip_live_reports (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.vip_live_sessions(id) on delete restrict,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reported_user_id uuid references auth.users(id) on delete set null,
  reason_code text not null check (char_length(trim(reason_code)) between 2 and 80),
  details text check (details is null or char_length(details) <= 2000),
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create table if not exists public.vip_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid references public.vip_live_sessions(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action_code text not null check (action_code in ('hide_message', 'remove_message', 'mute_user', 'ban_user', 'end_session', 'suspend_session', 'resolve_report')),
  reason text check (reason is null or char_length(reason) <= 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.vip_coin_packages (
  id uuid primary key default gen_random_uuid(),
  package_code text not null unique check (char_length(trim(package_code)) between 2 and 80),
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  coin_amount bigint not null check (coin_amount > 0),
  price_minor bigint not null check (price_minor > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  provider_product_ref text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vip_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  spendable_coins bigint not null default 0 check (spendable_coins >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vip_payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  package_id uuid references public.vip_coin_packages(id) on delete set null,
  package_code_snapshot text not null,
  coin_amount_snapshot bigint not null check (coin_amount_snapshot > 0),
  amount_minor bigint not null check (amount_minor > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  payment_provider text,
  provider_order_ref text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  idempotency_key text not null unique check (char_length(trim(idempotency_key)) between 8 and 200),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (payment_provider, provider_order_ref)
);

create table if not exists public.vip_payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid references public.vip_payment_orders(id) on delete restrict,
  payment_provider text not null,
  provider_event_ref text not null,
  event_type text not null,
  signature_verified boolean not null default false,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_result text,
  unique (payment_provider, provider_event_ref)
);

create table if not exists public.vip_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  delta_coins bigint not null check (delta_coins <> 0),
  entry_type text not null
    check (entry_type in ('purchase_credit', 'gift_debit', 'refund_credit', 'reversal', 'admin_adjustment')),
  reference_type text,
  reference_id uuid,
  idempotency_key text not null unique check (char_length(trim(idempotency_key)) between 8 and 200),
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.vip_gifts (
  id uuid primary key default gen_random_uuid(),
  gift_code text not null unique check (char_length(trim(gift_code)) between 2 and 80),
  name text not null check (char_length(trim(name)) between 1 and 120),
  category text not null default 'general' check (char_length(trim(category)) between 1 and 80),
  icon_asset_ref text,
  price_coins bigint not null check (price_coins > 0),
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vip_revenue_share_settings (
  id uuid primary key default gen_random_uuid(),
  creator_share_percent numeric(5,2) not null default 90.00 check (creator_share_percent between 0 and 100),
  platform_share_percent numeric(5,2) not null default 10.00 check (platform_share_percent between 0 and 100),
  is_active boolean not null default false,
  effective_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (creator_share_percent + platform_share_percent = 100.00)
);

create table if not exists public.vip_gift_transactions (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  recipient_user_id uuid not null references auth.users(id) on delete restrict,
  live_session_id uuid references public.vip_live_sessions(id) on delete restrict,
  gift_id uuid references public.vip_gifts(id) on delete restrict,
  gift_code_snapshot text not null,
  gift_name_snapshot text not null,
  price_coins_snapshot bigint not null check (price_coins_snapshot > 0),
  creator_share_percent numeric(5,2) not null check (creator_share_percent between 0 and 100),
  platform_share_percent numeric(5,2) not null check (platform_share_percent between 0 and 100),
  creator_share_coins bigint not null default 0 check (creator_share_coins >= 0),
  platform_share_coins bigint not null default 0 check (platform_share_coins >= 0),
  status text not null default 'pending' check (status in ('pending', 'settled', 'reversed')),
  idempotency_key text not null unique check (char_length(trim(idempotency_key)) between 8 and 200),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  check (sender_user_id <> recipient_user_id),
  check (creator_share_percent + platform_share_percent = 100.00),
  check (status <> 'settled' or creator_share_coins + platform_share_coins = price_coins_snapshot)
);

create table if not exists public.vip_creator_earnings_ledger (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references auth.users(id) on delete restrict,
  gift_transaction_id uuid references public.vip_gift_transactions(id) on delete restrict,
  delta_earned_coins bigint not null check (delta_earned_coins <> 0),
  entry_type text not null
    check (entry_type in ('gift_share', 'withdrawal_reserved', 'withdrawal_reversed', 'admin_adjustment')),
  idempotency_key text not null unique check (char_length(trim(idempotency_key)) between 8 and 200),
  created_at timestamptz not null default now()
);

create table if not exists public.vip_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  amount_coins bigint not null check (amount_coins > 0),
  currency_code text check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),
  amount_minor bigint check (amount_minor is null or amount_minor > 0),
  payout_provider text,
  provider_transfer_ref text,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'rejected', 'processing', 'paid', 'failed', 'cancelled')),
  idempotency_key text not null unique check (char_length(trim(idempotency_key)) between 8 and 200),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.vip_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action_code text not null check (char_length(trim(action_code)) between 2 and 120),
  entity_type text not null check (char_length(trim(entity_type)) between 2 and 120),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  request_ref text,
  created_at timestamptz not null default now()
);

-- Public status exposes only feature readiness, never user or financial data.
create table if not exists public.vip_feature_status (
  singleton boolean primary key default true check (singleton),
  schema_version text not null default 'vip_scaffold_v1',
  live_streaming_enabled boolean not null default false,
  coin_purchases_enabled boolean not null default false,
  gift_sending_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists vip_live_sessions_status_created_idx
  on public.vip_live_sessions (status, created_at desc);
create index if not exists vip_live_sessions_host_created_idx
  on public.vip_live_sessions (host_user_id, created_at desc);
create index if not exists vip_live_chat_session_created_idx
  on public.vip_live_chat_messages (live_session_id, created_at);
create index if not exists vip_live_reports_status_created_idx
  on public.vip_live_reports (status, created_at desc);
create index if not exists vip_wallet_ledger_user_created_idx
  on public.vip_wallet_ledger (user_id, created_at desc);
create index if not exists vip_payment_orders_user_created_idx
  on public.vip_payment_orders (user_id, created_at desc);
create index if not exists vip_gift_transactions_sender_created_idx
  on public.vip_gift_transactions (sender_user_id, created_at desc);
create index if not exists vip_gift_transactions_recipient_created_idx
  on public.vip_gift_transactions (recipient_user_id, created_at desc);
create index if not exists vip_creator_earnings_user_created_idx
  on public.vip_creator_earnings_ledger (creator_user_id, created_at desc);
create index if not exists vip_withdrawal_requests_user_created_idx
  on public.vip_withdrawal_requests (user_id, created_at desc);
create unique index if not exists vip_revenue_share_one_active_idx
  on public.vip_revenue_share_settings (is_active) where is_active;

create function public.iqzodiac_vip_has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.vip_user_roles r
    where r.user_id = auth.uid()
      and r.role = p_role
      and r.is_active
  );
$$;
revoke all on function public.iqzodiac_vip_has_role(text) from public;
grant execute on function public.iqzodiac_vip_has_role(text) to authenticated;

alter table public.vip_user_roles enable row level security;
alter table public.vip_live_sessions enable row level security;
alter table public.vip_live_chat_messages enable row level security;
alter table public.vip_live_reports enable row level security;
alter table public.vip_moderation_actions enable row level security;
alter table public.vip_coin_packages enable row level security;
alter table public.vip_wallets enable row level security;
alter table public.vip_payment_orders enable row level security;
alter table public.vip_payment_events enable row level security;
alter table public.vip_wallet_ledger enable row level security;
alter table public.vip_gifts enable row level security;
alter table public.vip_revenue_share_settings enable row level security;
alter table public.vip_gift_transactions enable row level security;
alter table public.vip_creator_earnings_ledger enable row level security;
alter table public.vip_withdrawal_requests enable row level security;
alter table public.vip_admin_audit_log enable row level security;
alter table public.vip_feature_status enable row level security;

alter table public.vip_user_roles force row level security;
alter table public.vip_live_sessions force row level security;
alter table public.vip_live_chat_messages force row level security;
alter table public.vip_live_reports force row level security;
alter table public.vip_moderation_actions force row level security;
alter table public.vip_coin_packages force row level security;
alter table public.vip_wallets force row level security;
alter table public.vip_payment_orders force row level security;
alter table public.vip_payment_events force row level security;
alter table public.vip_wallet_ledger force row level security;
alter table public.vip_gifts force row level security;
alter table public.vip_revenue_share_settings force row level security;
alter table public.vip_gift_transactions force row level security;
alter table public.vip_creator_earnings_ledger force row level security;
alter table public.vip_withdrawal_requests force row level security;
alter table public.vip_admin_audit_log force row level security;
alter table public.vip_feature_status force row level security;

revoke all on table public.vip_user_roles, public.vip_live_sessions, public.vip_live_chat_messages,
  public.vip_live_reports, public.vip_moderation_actions, public.vip_coin_packages, public.vip_wallets,
  public.vip_payment_orders, public.vip_payment_events, public.vip_wallet_ledger, public.vip_gifts,
  public.vip_revenue_share_settings, public.vip_gift_transactions, public.vip_creator_earnings_ledger,
  public.vip_withdrawal_requests, public.vip_admin_audit_log, public.vip_feature_status from anon, authenticated;

grant select on table public.vip_user_roles, public.vip_live_sessions, public.vip_live_chat_messages,
  public.vip_live_reports, public.vip_moderation_actions, public.vip_coin_packages, public.vip_wallets,
  public.vip_payment_orders, public.vip_payment_events, public.vip_wallet_ledger, public.vip_gifts,
  public.vip_revenue_share_settings, public.vip_gift_transactions, public.vip_creator_earnings_ledger,
  public.vip_withdrawal_requests, public.vip_admin_audit_log to authenticated;
grant select on table public.vip_feature_status to anon, authenticated;

create policy vip_user_roles_read_self_or_admin on public.vip_user_roles
  for select to authenticated using (user_id = auth.uid() or public.iqzodiac_vip_has_role('admin'));
create policy vip_live_sessions_read_vip on public.vip_live_sessions
  for select to authenticated using (public.iqzodiac_vip_has_role('vip') or public.iqzodiac_vip_has_role('admin'));
create policy vip_live_chat_read_vip on public.vip_live_chat_messages
  for select to authenticated using (
    (public.iqzodiac_vip_has_role('vip') or public.iqzodiac_vip_has_role('admin'))
    and exists (select 1 from public.vip_live_sessions s where s.id = live_session_id)
  );
create policy vip_live_reports_read_reporter_or_admin on public.vip_live_reports
  for select to authenticated using (reporter_user_id = auth.uid() or public.iqzodiac_vip_has_role('admin'));
create policy vip_moderation_actions_read_moderators on public.vip_moderation_actions
  for select to authenticated using (public.iqzodiac_vip_has_role('moderator') or public.iqzodiac_vip_has_role('admin'));
create policy vip_coin_packages_read_active_vip on public.vip_coin_packages
  for select to authenticated using (is_active and (public.iqzodiac_vip_has_role('vip') or public.iqzodiac_vip_has_role('admin')));
create policy vip_wallets_read_own_or_admin on public.vip_wallets
  for select to authenticated using (user_id = auth.uid() or public.iqzodiac_vip_has_role('admin'));
create policy vip_payment_orders_read_own_or_admin on public.vip_payment_orders
  for select to authenticated using (user_id = auth.uid() or public.iqzodiac_vip_has_role('admin'));
create policy vip_payment_events_read_admin on public.vip_payment_events
  for select to authenticated using (public.iqzodiac_vip_has_role('admin'));
create policy vip_wallet_ledger_read_own_or_admin on public.vip_wallet_ledger
  for select to authenticated using (user_id = auth.uid() or public.iqzodiac_vip_has_role('admin'));
create policy vip_gifts_read_active_vip on public.vip_gifts
  for select to authenticated using (is_active and (public.iqzodiac_vip_has_role('vip') or public.iqzodiac_vip_has_role('admin')));
create policy vip_revenue_share_read_active_vip on public.vip_revenue_share_settings
  for select to authenticated using (is_active and (public.iqzodiac_vip_has_role('vip') or public.iqzodiac_vip_has_role('admin')));
create policy vip_gift_transactions_read_parties_or_admin on public.vip_gift_transactions
  for select to authenticated using (
    sender_user_id = auth.uid() or recipient_user_id = auth.uid() or public.iqzodiac_vip_has_role('admin')
  );
create policy vip_creator_earnings_read_owner_or_admin on public.vip_creator_earnings_ledger
  for select to authenticated using (creator_user_id = auth.uid() or public.iqzodiac_vip_has_role('admin'));
create policy vip_withdrawal_requests_read_owner_or_admin on public.vip_withdrawal_requests
  for select to authenticated using (user_id = auth.uid() or public.iqzodiac_vip_has_role('admin'));
create policy vip_admin_audit_read_admin on public.vip_admin_audit_log
  for select to authenticated using (public.iqzodiac_vip_has_role('admin'));
create policy vip_feature_status_read_public on public.vip_feature_status
  for select to anon, authenticated using (singleton);

-- The 90/10 split is a versionable initial rule explicitly requested by the owner.
-- No wallets, package prices, gifts, payments, or user data are seeded.
insert into public.vip_revenue_share_settings (creator_share_percent, platform_share_percent, is_active)
values (90.00, 10.00, true)
on conflict do nothing;

insert into public.vip_feature_status (singleton, schema_version)
values (true, 'vip_scaffold_v1')
on conflict (singleton) do nothing;
