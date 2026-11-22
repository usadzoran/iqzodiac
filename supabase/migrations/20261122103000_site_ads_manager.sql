-- Additive site advertising inventory. Existing content and tables are untouched.
create table if not exists public.site_ads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  placement text not null check (placement in ('header','hero','feed_between','reels_between','footer')),
  html_code text not null check (char_length(html_code) between 1 and 200000),
  height_px integer not null default 100 check (height_px between 40 and 600),
  priority integer not null default 0 check (priority between -10000 and 10000),
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists site_ads_active_placement_idx
  on public.site_ads (placement, priority desc, created_at desc)
  where is_active;

alter table public.site_ads enable row level security;
alter table public.site_ads force row level security;
revoke all on table public.site_ads from anon, authenticated;
grant select on table public.site_ads to anon, authenticated;
grant insert, update, delete on table public.site_ads to authenticated;

drop policy if exists site_ads_public_active_read on public.site_ads;
create policy site_ads_public_active_read on public.site_ads
  for select to anon, authenticated
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

drop policy if exists site_ads_admin_read on public.site_ads;
create policy site_ads_admin_read on public.site_ads
  for select to authenticated using (public.iqzodiac_is_admin());

drop policy if exists site_ads_admin_insert on public.site_ads;
create policy site_ads_admin_insert on public.site_ads
  for insert to authenticated
  with check (public.iqzodiac_is_admin() and created_by = auth.uid());

drop policy if exists site_ads_admin_update on public.site_ads;
create policy site_ads_admin_update on public.site_ads
  for update to authenticated
  using (public.iqzodiac_is_admin())
  with check (public.iqzodiac_is_admin());

drop policy if exists site_ads_admin_delete on public.site_ads;
create policy site_ads_admin_delete on public.site_ads
  for delete to authenticated using (public.iqzodiac_is_admin());
