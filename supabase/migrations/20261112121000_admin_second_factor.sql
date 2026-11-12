-- Second factor for the private admin route.
-- The plaintext password is provisioned separately and is never stored in the repository.
create extension if not exists pgcrypto;

create table if not exists public.iqzodiac_admin_access_config (
  singleton boolean primary key default true check (singleton),
  password_hash text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.iqzodiac_admin_access_config enable row level security;
alter table public.iqzodiac_admin_access_config force row level security;
revoke all on table public.iqzodiac_admin_access_config from anon, authenticated;

create or replace function public.iqzodiac_verify_admin_second_factor(p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_hash text;
begin
  if not public.iqzodiac_is_admin() or p_password is null or char_length(p_password) < 8 then
    return false;
  end if;
  select password_hash into v_hash from public.iqzodiac_admin_access_config where singleton = true limit 1;
  return v_hash is not null and crypt(p_password, v_hash) = v_hash;
end;
$$;
revoke all on function public.iqzodiac_verify_admin_second_factor(text) from public, anon;
grant execute on function public.iqzodiac_verify_admin_second_factor(text) to authenticated;

create or replace function public.iqzodiac_set_admin_second_factor(p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.iqzodiac_is_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_password is null or char_length(p_password) < 8 then raise exception 'admin_password_too_short'; end if;
  insert into public.iqzodiac_admin_access_config(singleton, password_hash, updated_by)
  values (true, crypt(p_password, gen_salt('bf', 12)), auth.uid())
  on conflict (singleton) do update set password_hash = excluded.password_hash, updated_at = now(), updated_by = auth.uid();
  perform public.iqzodiac_admin_audit('rotate_admin_second_factor', 'admin_access_config', null, '{}'::jsonb);
  return true;
end;
$$;
revoke all on function public.iqzodiac_set_admin_second_factor(text) from public, anon;
grant execute on function public.iqzodiac_set_admin_second_factor(text) to authenticated;
