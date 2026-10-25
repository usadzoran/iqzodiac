-- Harden the auth profile trigger functions after deployment.
create or replace function public.new_pseudonym()
returns text
language plpgsql
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := (array['Nova','Luna','Orion','Astra','Echo','Comet','Sage','River','Sol','Lyra'])[1 + floor(random() * 10)::int]
      || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    exit when not exists (select 1 from public.profiles where display_name = candidate);
  end loop;
  return candidate;
end;
$$;

revoke execute on function public.new_pseudonym() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
