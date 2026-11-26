-- pgcrypto is installed in the extensions schema on this Supabase project.
-- Qualify its functions explicitly because these SECURITY DEFINER functions
-- intentionally use a restricted search_path.
create or replace function public.iqzodiac_verify_admin_second_factor(p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_hash text;
begin
  if auth.uid() is null or p_password is null or char_length(trim(p_password)) < 8 then
    return false;
  end if;

  select password_hash into v_hash
  from public.iqzodiac_admin_access_config
  where singleton = true
  limit 1;

  return v_hash is not null
    and extensions.crypt(trim(p_password), v_hash) = v_hash;
end;
$function$;

revoke all on function public.iqzodiac_verify_admin_second_factor(text) from public, anon;
grant execute on function public.iqzodiac_verify_admin_second_factor(text) to authenticated;

create or replace function public.iqzodiac_set_admin_second_factor(p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
begin
  if not public.iqzodiac_is_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_password is null or char_length(trim(p_password)) < 8 then
    raise exception 'admin_password_too_short';
  end if;

  insert into public.iqzodiac_admin_access_config(singleton, password_hash, updated_by)
  values (true, extensions.crypt(trim(p_password), extensions.gen_salt('bf', 12)), auth.uid())
  on conflict (singleton) do update
    set password_hash = excluded.password_hash,
        updated_at = now(),
        updated_by = auth.uid();

  perform public.iqzodiac_admin_audit('rotate_admin_second_factor', 'admin_access_config', null, '{}'::jsonb);
  return true;
end;
$function$;

revoke all on function public.iqzodiac_set_admin_second_factor(text) from public, anon;
grant execute on function public.iqzodiac_set_admin_second_factor(text) to authenticated;
