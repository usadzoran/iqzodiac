-- Search public pseudonymous identities for @mention autocomplete.
create or replace function public.search_mention_profiles(p_query text default '', p_limit integer default 6)
returns table(user_id uuid, display_name text, handle text)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.display_name, p.handle
  from public.profiles p
  where auth.uid() is not null
    and length(trim(coalesce(p_query, ''))) between 1 and 24
    and (
      lower(ltrim(p.handle, '@')) like lower(trim(p_query)) || '%'
      or lower(p.display_name) like '%' || lower(trim(p_query)) || '%'
    )
  order by
    case when lower(ltrim(p.handle, '@')) like lower(trim(p_query)) || '%' then 0 else 1 end,
    p.handle
  limit least(greatest(coalesce(p_limit, 6), 1), 10);
$$;

revoke all on function public.search_mention_profiles(text, integer) from public, anon;
grant execute on function public.search_mention_profiles(text, integer) to authenticated;
