-- Dedicated admin identity allowlist.
-- This email is intentionally separate from the member/profile population.
create table if not exists public.iqzodiac_admin_email_allowlist (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

alter table public.iqzodiac_admin_email_allowlist enable row level security;
alter table public.iqzodiac_admin_email_allowlist force row level security;
revoke all on table public.iqzodiac_admin_email_allowlist from anon, authenticated;

insert into public.iqzodiac_admin_email_allowlist(email)
values ('adminpro@iqzodiac.com')
on conflict (email) do nothing;

create or replace function public.iqzodiac_is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_catalog
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.salon_owner_roles r where r.user_id = auth.uid() and r.role = 'owner')
    or exists (select 1 from public.vip_user_roles r where r.user_id = auth.uid() and r.role = 'admin' and coalesce(r.is_active, true))
    or exists (select 1 from public.iqzodiac_admin_email_allowlist a where lower(a.email) = lower(coalesce(auth.jwt()->>'email', '')))
  );
$$;
revoke all on function public.iqzodiac_is_admin() from public;
revoke execute on function public.iqzodiac_is_admin() from anon;
grant execute on function public.iqzodiac_is_admin() to authenticated;

-- Dedicated admin accounts do not receive a public member profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare pseudonym text := public.new_pseudonym();
begin
  if exists (select 1 from public.iqzodiac_admin_email_allowlist a where lower(a.email) = lower(coalesce(new.email, ''))) then
    return new;
  end if;
  insert into public.profiles (user_id, first_name, last_name, age, phone, country, city, preferred_language, display_name, handle)
  values (new.id, coalesce(new.raw_user_meta_data->>'first_name', ''), coalesce(new.raw_user_meta_data->>'last_name', ''), nullif(new.raw_user_meta_data->>'age', '')::smallint, coalesce(new.raw_user_meta_data->>'phone', ''), coalesce(new.raw_user_meta_data->>'country', ''), coalesce(new.raw_user_meta_data->>'city', ''), case when new.raw_user_meta_data->>'preferred_language' = 'ar' then 'ar' else 'en' end, pseudonym, '@' || lower(replace(pseudonym, '-', '')))
  on conflict (user_id) do update set first_name = excluded.first_name, last_name = excluded.last_name, age = excluded.age, phone = excluded.phone, country = excluded.country, city = excluded.city, preferred_language = excluded.preferred_language, updated_at = now();
  return new;
end;
$$;
