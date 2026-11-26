-- Granular permissions for public site-content editors, plus an empty managed footer menu.
-- This migration does not create users, page content, menu links, or test records.

create table if not exists public.site_content_moderator_scopes (
  user_id uuid not null references public.site_content_moderators(user_id) on delete cascade,
  scope_key text not null check (scope_key in (
    'public_pages',
    'home_sections',
    'discover_sections',
    'marketplace_sections',
    'profile_sections',
    'marketplace_categories'
  )),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, scope_key)
);

alter table public.site_content_moderator_scopes enable row level security;
revoke all on table public.site_content_moderator_scopes from anon, authenticated;

-- Existing active editors previously had broad site-content access; retain that access explicitly.
insert into public.site_content_moderator_scopes (user_id, scope_key, granted_by, granted_at)
select m.user_id, s.scope_key, m.granted_by, m.granted_at
from public.site_content_moderators m
cross join unnest(array[
  'public_pages',
  'home_sections',
  'discover_sections',
  'marketplace_sections',
  'profile_sections',
  'marketplace_categories'
]::text[]) as s(scope_key)
where m.is_active
on conflict (user_id, scope_key) do nothing;

create or replace function public.iqzodiac_has_site_content_scope(p_scope text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(public.iqzodiac_is_admin(), false)
    or exists (
      select 1
      from public.site_content_moderators m
      join public.site_content_moderator_scopes s on s.user_id = m.user_id
      where m.user_id = auth.uid()
        and m.is_active = true
        and s.scope_key = p_scope
    );
$$;
revoke all on function public.iqzodiac_has_site_content_scope(text) from public;
grant execute on function public.iqzodiac_has_site_content_scope(text) to anon, authenticated;

create or replace function public.iqzodiac_my_site_content_scopes()
returns text[]
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select case
    when coalesce(public.iqzodiac_is_admin(), false) then array[
      'public_pages', 'home_sections', 'discover_sections',
      'marketplace_sections', 'profile_sections', 'marketplace_categories'
    ]::text[]
    else coalesce(array_agg(s.scope_key order by s.scope_key), array[]::text[])
  end
  from public.site_content_moderators m
  left join public.site_content_moderator_scopes s on s.user_id = m.user_id
  where m.user_id = auth.uid() and m.is_active = true;
$$;
revoke all on function public.iqzodiac_my_site_content_scopes() from public;
grant execute on function public.iqzodiac_my_site_content_scopes() to authenticated;

create or replace function public.iqzodiac_can_manage_site_content()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(public.iqzodiac_is_admin(), false)
    or exists (
      select 1
      from public.site_content_moderators m
      join public.site_content_moderator_scopes s on s.user_id = m.user_id
      where m.user_id = auth.uid() and m.is_active = true
    );
$$;
revoke all on function public.iqzodiac_can_manage_site_content() from public;
grant execute on function public.iqzodiac_can_manage_site_content() to anon, authenticated;

create or replace function public.iqzodiac_can_manage_site_page(p_content_type text, p_display_location text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(public.iqzodiac_is_admin(), false)
    or case
      when p_content_type = 'page' and p_display_location = 'pages'
        then public.iqzodiac_has_site_content_scope('public_pages')
      when p_content_type = 'section' and p_display_location = 'home'
        then public.iqzodiac_has_site_content_scope('home_sections')
      when p_content_type = 'section' and p_display_location = 'discover'
        then public.iqzodiac_has_site_content_scope('discover_sections')
      when p_content_type = 'section' and p_display_location = 'marketplace'
        then public.iqzodiac_has_site_content_scope('marketplace_sections')
      when p_content_type = 'section' and p_display_location = 'profile'
        then public.iqzodiac_has_site_content_scope('profile_sections')
      else false
    end;
$$;
revoke all on function public.iqzodiac_can_manage_site_page(text, text) from public;
grant execute on function public.iqzodiac_can_manage_site_page(text, text) to anon, authenticated;

create or replace function public.iqzodiac_can_manage_marketplace_categories()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select public.iqzodiac_has_site_content_scope('marketplace_categories');
$$;
revoke all on function public.iqzodiac_can_manage_marketplace_categories() from public;
grant execute on function public.iqzodiac_can_manage_marketplace_categories() to anon, authenticated;

-- Enforce page-area scopes at the row boundary; administrators retain full access.
drop policy if exists site_pages_public_or_manager_read on public.site_pages;
create policy site_pages_public_or_manager_read on public.site_pages
  for select to anon, authenticated
  using (is_published or public.iqzodiac_can_manage_site_page(content_type, display_location));

drop policy if exists site_pages_manager_insert on public.site_pages;
create policy site_pages_manager_insert on public.site_pages
  for insert to authenticated
  with check (public.iqzodiac_can_manage_site_page(content_type, display_location));

drop policy if exists site_pages_manager_update on public.site_pages;
create policy site_pages_manager_update on public.site_pages
  for update to authenticated
  using (public.iqzodiac_can_manage_site_page(content_type, display_location))
  with check (public.iqzodiac_can_manage_site_page(content_type, display_location));

-- Marketplace category management is a separate scope from page/section editing.
drop policy if exists marketplace_categories_public_read on public.marketplace_categories;
create policy marketplace_categories_public_read on public.marketplace_categories
  for select to authenticated
  using (is_active or public.iqzodiac_can_manage_marketplace_categories());

create or replace function public.iqzodiac_content_add_marketplace_category(
  p_kind text,
  p_name_en text,
  p_name_ar text
)
returns public.marketplace_categories
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v public.marketplace_categories;
  v_kind text := lower(trim(coalesce(p_kind, '')));
  v_name_en text := trim(coalesce(p_name_en, ''));
  v_name_ar text := trim(coalesce(p_name_ar, ''));
  v_slug_part text;
begin
  if not public.iqzodiac_can_manage_marketplace_categories() then
    raise exception 'site_content_scope_required' using errcode = '42501';
  end if;
  if v_kind not in ('product', 'service') then raise exception 'invalid_category_kind' using errcode = '22023'; end if;
  if char_length(v_name_en) not between 1 and 80 or char_length(v_name_ar) not between 1 and 80 then raise exception 'invalid_category_name' using errcode = '22023'; end if;
  v_slug_part := trim(both '-' from regexp_replace(lower(v_name_en), '[^a-z0-9]+', '-', 'g'));
  if v_slug_part = '' then raise exception 'english_category_name_must_include_latin_letters_or_digits' using errcode = '22023'; end if;
  insert into public.marketplace_categories(kind, slug, name_en, name_ar, is_active, sort_order, created_by)
  values (v_kind, v_kind || '-' || v_slug_part, v_name_en, v_name_ar, true, 500, auth.uid())
  returning * into v;
  return v;
end;
$$;
revoke all on function public.iqzodiac_content_add_marketplace_category(text, text, text) from public, anon;
grant execute on function public.iqzodiac_content_add_marketplace_category(text, text, text) to authenticated;

create or replace function public.iqzodiac_content_update_marketplace_category(
  p_category_id uuid,
  p_name_en text,
  p_name_ar text,
  p_is_active boolean,
  p_sort_order integer
)
returns public.marketplace_categories
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v public.marketplace_categories;
  v_name_en text := trim(coalesce(p_name_en, ''));
  v_name_ar text := trim(coalesce(p_name_ar, ''));
begin
  if not public.iqzodiac_can_manage_marketplace_categories() then
    raise exception 'site_content_scope_required' using errcode = '42501';
  end if;
  if p_category_id is null or char_length(v_name_en) not between 1 and 80 or char_length(v_name_ar) not between 1 and 80 then raise exception 'invalid_category_data' using errcode = '22023'; end if;
  if p_sort_order is null or p_sort_order not between 0 and 1000000 then raise exception 'invalid_sort_order' using errcode = '22023'; end if;
  update public.marketplace_categories
    set name_en = v_name_en, name_ar = v_name_ar,
        is_active = coalesce(p_is_active, false), sort_order = p_sort_order
    where id = p_category_id
    returning * into v;
  if not found then raise exception 'category_not_found' using errcode = 'P0002'; end if;
  return v;
end;
$$;
revoke all on function public.iqzodiac_content_update_marketplace_category(uuid, text, text, boolean, integer) from public, anon;
grant execute on function public.iqzodiac_content_update_marketplace_category(uuid, text, text, boolean, integer) to authenticated;

-- Replace the admin list RPC to include the assigned scopes for editing.
drop function if exists public.iqzodiac_admin_list_site_content_moderators();
create function public.iqzodiac_admin_list_site_content_moderators()
returns table (
  user_id uuid,
  email text,
  is_active boolean,
  granted_at timestamptz,
  revoked_at timestamptz,
  display_name text,
  handle text,
  scopes text[]
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
begin
  if not public.iqzodiac_is_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  return query
    select m.user_id, u.email::text, m.is_active, m.granted_at, m.revoked_at,
           p.display_name, p.handle,
           coalesce(array_agg(s.scope_key order by s.scope_key) filter (where s.scope_key is not null), array[]::text[])
    from public.site_content_moderators m
    join auth.users u on u.id = m.user_id
    left join public.profiles p on p.user_id = m.user_id
    left join public.site_content_moderator_scopes s on s.user_id = m.user_id
    group by m.user_id, u.email, m.is_active, m.granted_at, m.revoked_at, p.display_name, p.handle
    order by m.is_active desc, m.granted_at desc
    limit 300;
end;
$$;
revoke all on function public.iqzodiac_admin_list_site_content_moderators() from public, anon;
grant execute on function public.iqzodiac_admin_list_site_content_moderators() to authenticated;

create or replace function public.iqzodiac_admin_set_site_content_moderator(p_email text, p_is_active boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid;
  v_email text;
  v_active boolean := coalesce(p_is_active, false);
  v_default_scopes text[] := array[
    'public_pages', 'home_sections', 'discover_sections',
    'marketplace_sections', 'profile_sections', 'marketplace_categories'
  ];
begin
  if not public.iqzodiac_is_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  v_email := lower(trim(coalesce(p_email, '')));
  if char_length(v_email) not between 5 and 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  select u.id, lower(u.email) into v_uid, v_email
    from auth.users u
    where lower(u.email) = v_email and u.email_confirmed_at is not null
    limit 1;
  if v_uid is null then raise exception 'confirmed_user_not_found' using errcode = 'P0002'; end if;
  if v_active then
    insert into public.site_content_moderators(user_id, is_active, granted_by, granted_at, revoked_by, revoked_at)
    values (v_uid, true, auth.uid(), now(), null, null)
    on conflict (user_id) do update
      set is_active = true, granted_by = auth.uid(), granted_at = now(), revoked_by = null, revoked_at = null;
    if not exists (select 1 from public.site_content_moderator_scopes s where s.user_id = v_uid) then
      insert into public.site_content_moderator_scopes(user_id, scope_key, granted_by)
      select v_uid, s.scope_key, auth.uid() from unnest(v_default_scopes) as s(scope_key)
      on conflict (user_id, scope_key) do nothing;
    end if;
  else
    update public.site_content_moderators
      set is_active = false, revoked_by = auth.uid(), revoked_at = now()
      where user_id = v_uid;
    if not found then raise exception 'site_content_moderator_not_found' using errcode = 'P0002'; end if;
  end if;
  perform public.iqzodiac_admin_audit(
    case when v_active then 'grant_site_content_moderator' else 'revoke_site_content_moderator' end,
    'site_content_moderator', v_uid, jsonb_build_object('email', v_email, 'is_active', v_active)
  );
  return jsonb_build_object('user_id', v_uid, 'email', v_email, 'is_active', v_active);
end;
$$;
revoke all on function public.iqzodiac_admin_set_site_content_moderator(text, boolean) from public, anon;
grant execute on function public.iqzodiac_admin_set_site_content_moderator(text, boolean) to authenticated;

create or replace function public.iqzodiac_admin_set_site_content_moderator_scopes(p_email text, p_scopes text[])
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid;
  v_email text;
  v_scopes text[];
  v_allowed_scopes text[] := array[
    'public_pages', 'home_sections', 'discover_sections',
    'marketplace_sections', 'profile_sections', 'marketplace_categories'
  ];
begin
  if not public.iqzodiac_is_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  v_email := lower(trim(coalesce(p_email, '')));
  if char_length(v_email) not between 5 and 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if p_scopes is null or cardinality(p_scopes) = 0
    or exists (
      select 1 from unnest(p_scopes) as s(scope_key)
      where s.scope_key is null or not (s.scope_key = any(v_allowed_scopes))
    ) then
    raise exception 'invalid_site_content_scopes' using errcode = '22023';
  end if;
  select array_agg(distinct s.scope_key order by s.scope_key)
    into v_scopes from unnest(p_scopes) as s(scope_key);
  select u.id, lower(u.email) into v_uid, v_email
    from auth.users u
    where lower(u.email) = v_email and u.email_confirmed_at is not null
    limit 1;
  if v_uid is null then raise exception 'confirmed_user_not_found' using errcode = 'P0002'; end if;

  insert into public.site_content_moderators(user_id, is_active, granted_by, granted_at, revoked_by, revoked_at)
  values (v_uid, true, auth.uid(), now(), null, null)
  on conflict (user_id) do update
    set is_active = true, granted_by = auth.uid(), granted_at = now(), revoked_by = null, revoked_at = null;
  delete from public.site_content_moderator_scopes where user_id = v_uid;
  insert into public.site_content_moderator_scopes(user_id, scope_key, granted_by)
  select v_uid, s.scope_key, auth.uid() from unnest(v_scopes) as s(scope_key);

  perform public.iqzodiac_admin_audit(
    'set_site_content_moderator_scopes', 'site_content_moderator', v_uid,
    jsonb_build_object('email', v_email, 'is_active', true, 'scopes', to_jsonb(v_scopes))
  );
  return jsonb_build_object('user_id', v_uid, 'email', v_email, 'is_active', true, 'scopes', to_jsonb(v_scopes));
end;
$$;
revoke all on function public.iqzodiac_admin_set_site_content_moderator_scopes(text, text[]) from public, anon;
grant execute on function public.iqzodiac_admin_set_site_content_moderator_scopes(text, text[]) to authenticated;

-- Ensure there is a real, editable footer-menu record without inventing any links.
insert into public.site_menus (menu_key, title_en, title_ar, location, is_active, sort_order)
select 'footer', 'Footer menu', 'قائمة التذييل', 'footer', true, 100
where not exists (select 1 from public.site_menus where location = 'footer')
on conflict (menu_key) do nothing;
