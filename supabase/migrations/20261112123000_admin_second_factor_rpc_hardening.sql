-- Harden second-factor verification: normalize input and keep it independent from the UI admin pre-check.
create or replace function public.iqzodiac_verify_admin_second_factor(p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_hash text;
begin
  if auth.uid() is null or p_password is null or char_length(trim(p_password)) < 8 then return false; end if;
  select password_hash into v_hash from public.iqzodiac_admin_access_config where singleton = true limit 1;
  return v_hash is not null and crypt(trim(p_password), v_hash) = v_hash;
end;
$$;
revoke all on function public.iqzodiac_verify_admin_second_factor(text) from public, anon;
grant execute on function public.iqzodiac_verify_admin_second_factor(text) to authenticated;
