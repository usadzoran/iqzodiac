-- Public pages and a scoped site-content editor role, independent from VIP/live-room moderators.

create table if not exists public.site_content_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz
);
alter table public.site_content_moderators enable row level security;
revoke all on table public.site_content_moderators from anon, authenticated;

create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title_en text not null check (char_length(trim(title_en)) between 1 and 120),
  title_ar text not null check (char_length(trim(title_ar)) between 1 and 120),
  body_en text not null default '' check (char_length(body_en) <= 30000),
  body_ar text not null default '' check (char_length(body_ar) <= 30000),
  is_published boolean not null default false,
  sort_order integer not null default 100 check (sort_order between 0 and 1000000),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists site_pages_public_order_idx on public.site_pages(is_published, sort_order, title_en);
alter table public.site_pages enable row level security;
alter table public.site_pages force row level security;
grant select on public.site_pages to anon, authenticated;
grant insert (slug, title_en, title_ar, body_en, body_ar, is_published, sort_order) on public.site_pages to authenticated;
grant update (slug, title_en, title_ar, body_en, body_ar, is_published, sort_order) on public.site_pages to authenticated;

create table if not exists public.site_content_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null check (entity_type in ('site_pages', 'marketplace_categories')),
  entity_id uuid not null,
  action_code text not null check (action_code in ('INSERT', 'UPDATE', 'DELETE')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists site_content_audit_log_created_idx on public.site_content_audit_log(created_at desc);
alter table public.site_content_audit_log enable row level security;
alter table public.site_content_audit_log force row level security;
revoke all on table public.site_content_audit_log from anon, authenticated;
grant select on public.site_content_audit_log to authenticated;
drop policy if exists site_content_audit_log_admin_read on public.site_content_audit_log;
create policy site_content_audit_log_admin_read on public.site_content_audit_log
  for select to authenticated using (public.iqzodiac_is_admin());

create or replace function public.iqzodiac_can_manage_site_content()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(public.iqzodiac_is_admin(), false)
    or exists (
      select 1 from public.site_content_moderators m
      where m.user_id = auth.uid() and m.is_active = true
    );
$$;
revoke all on function public.iqzodiac_can_manage_site_content() from public;
grant execute on function public.iqzodiac_can_manage_site_content() to anon, authenticated;

create or replace function public.iqzodiac_set_site_page_attribution()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists site_pages_set_attribution on public.site_pages;
create trigger site_pages_set_attribution
  before insert or update on public.site_pages
  for each row execute function public.iqzodiac_set_site_page_attribution();

create or replace function public.iqzodiac_audit_site_content_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_id uuid;
begin
  if tg_op = 'DELETE' then
    v_id := old.id;
    insert into public.site_content_audit_log(actor_user_id, entity_type, entity_id, action_code, before_data, after_data)
    values (auth.uid(), tg_table_name, v_id, tg_op, to_jsonb(old), null);
    return old;
  elsif tg_op = 'INSERT' then
    v_id := new.id;
    insert into public.site_content_audit_log(actor_user_id, entity_type, entity_id, action_code, before_data, after_data)
    values (auth.uid(), tg_table_name, v_id, tg_op, null, to_jsonb(new));
    return new;
  else
    v_id := new.id;
    insert into public.site_content_audit_log(actor_user_id, entity_type, entity_id, action_code, before_data, after_data)
    values (auth.uid(), tg_table_name, v_id, tg_op, to_jsonb(old), to_jsonb(new));
    return new;
  end if;
end;
$$;
drop trigger if exists site_pages_audit_changes on public.site_pages;
create trigger site_pages_audit_changes
  after insert or update or delete on public.site_pages
  for each row execute function public.iqzodiac_audit_site_content_change();
drop trigger if exists marketplace_categories_audit_changes on public.marketplace_categories;
create trigger marketplace_categories_audit_changes
  after insert or update or delete on public.marketplace_categories
  for each row execute function public.iqzodiac_audit_site_content_change();

 drop policy if exists site_pages_public_or_manager_read on public.site_pages;
create policy site_pages_public_or_manager_read on public.site_pages
  for select to anon, authenticated
  using (is_published or public.iqzodiac_can_manage_site_content());
drop policy if exists site_pages_manager_insert on public.site_pages;
create policy site_pages_manager_insert on public.site_pages
  for insert to authenticated with check (public.iqzodiac_can_manage_site_content());
drop policy if exists site_pages_manager_update on public.site_pages;
create policy site_pages_manager_update on public.site_pages
  for update to authenticated using (public.iqzodiac_can_manage_site_content())
  with check (public.iqzodiac_can_manage_site_content());

-- Keep category writes scoped to dedicated functions. Editors may read inactive rows,
-- create categories within Product/Service, update labels/order/visibility, but cannot delete.
drop policy if exists marketplace_categories_public_read on public.marketplace_categories;
create policy marketplace_categories_public_read on public.marketplace_categories
  for select to authenticated
  using (is_active or public.iqzodiac_can_manage_site_content());

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
  if not public.iqzodiac_can_manage_site_content() then raise exception 'site_content_manager_required' using errcode = '42501'; end if;
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
  if not public.iqzodiac_can_manage_site_content() then raise exception 'site_content_manager_required' using errcode = '42501'; end if;
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

create or replace function public.iqzodiac_admin_list_site_content_moderators()
returns table (
  user_id uuid,
  email text,
  is_active boolean,
  granted_at timestamptz,
  revoked_at timestamptz,
  display_name text,
  handle text
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
begin
  if not public.iqzodiac_is_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  return query
    select m.user_id, u.email::text, m.is_active, m.granted_at, m.revoked_at,
           p.display_name, p.handle
    from public.site_content_moderators m
    join auth.users u on u.id = m.user_id
    left join public.profiles p on p.user_id = m.user_id
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
begin
  if not public.iqzodiac_is_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  v_email := lower(trim(coalesce(p_email, '')));
  if char_length(v_email) not between 5 and 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
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
