-- Additive IQZodiac staff permissions, site-structure controls, and menu visibility.
-- This migration intentionally does not create Auth users or mutate existing content rows.

create table if not exists public.iqzodiac_admin_employees (
  user_id uuid primary key references auth.users(id) on delete cascade,
  job_title text not null check (char_length(trim(job_title)) between 1 and 120),
  job_description text not null default '' check (char_length(job_description) <= 1000),
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz
);

create table if not exists public.iqzodiac_admin_employee_permissions (
  user_id uuid not null references public.iqzodiac_admin_employees(user_id) on delete cascade,
  module_key text not null check (module_key in (
    'news_articles', 'posts_feed', 'reels_videos', 'discover_match',
    'members_profiles', 'marketplace', 'reports_moderation', 'live_audio',
    'website_pages_content', 'website_menus'
  )),
  permission_key text not null check (permission_key in (
    'view', 'create', 'edit', 'publish', 'unpublish', 'delete', 'moderate', 'manage_settings'
  )),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, module_key, permission_key)
);

alter table public.iqzodiac_admin_employees enable row level security;
alter table public.iqzodiac_admin_employee_permissions enable row level security;
revoke all on public.iqzodiac_admin_employees, public.iqzodiac_admin_employee_permissions from anon, authenticated;

-- The owner predicate is deliberately independent of legacy admin/VIP/allowlist checks.
create or replace function public.iqzodiac_is_master_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(public.salon_is_owner(), false);
$$;
revoke all on function public.iqzodiac_is_master_admin() from public, anon;
grant execute on function public.iqzodiac_is_master_admin() to authenticated;

create or replace function public.iqzodiac_admin_has_module_permission(p_module_key text, p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select case
    when p_module_key not in (
      'news_articles', 'posts_feed', 'reels_videos', 'discover_match',
      'members_profiles', 'marketplace', 'reports_moderation', 'live_audio',
      'website_pages_content', 'website_menus'
    ) or p_permission_key not in (
      'view', 'create', 'edit', 'publish', 'unpublish', 'delete', 'moderate', 'manage_settings'
    ) then false
    when coalesce(public.salon_is_owner(), false) or coalesce(public.iqzodiac_is_admin(), false) then true
    else exists (
      select 1
      from public.iqzodiac_admin_employees e
      join public.iqzodiac_admin_employee_permissions p on p.user_id = e.user_id
      where e.user_id = auth.uid() and e.status = 'active'
        and p.module_key = p_module_key and p.permission_key = p_permission_key
    )
  end;
$$;
revoke all on function public.iqzodiac_admin_has_module_permission(text, text) from public, anon;
grant execute on function public.iqzodiac_admin_has_module_permission(text, text) to anon, authenticated;

create or replace function public.iqzodiac_admin_my_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_master boolean;
  v_admin boolean;
  v_status text;
  v_job_title text;
  v_permissions jsonb := '{}'::jsonb;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  v_master := coalesce(public.salon_is_owner(), false);
  v_admin := coalesce(public.iqzodiac_is_admin(), false);
  select e.status, e.job_title into v_status, v_job_title
    from public.iqzodiac_admin_employees e where e.user_id = v_user_id;
  if v_status = 'active' then
    select coalesce(jsonb_object_agg(q.module_key, q.permissions), '{}'::jsonb)
      into v_permissions
    from (
      select p.module_key, jsonb_agg(p.permission_key order by p.permission_key) as permissions
      from public.iqzodiac_admin_employee_permissions p
      where p.user_id = v_user_id
      group by p.module_key
    ) q;
  end if;
  return jsonb_build_object(
    'is_master', v_master,
    'is_admin', v_admin,
    'is_employee', v_status = 'active',
    'employee_status', v_status,
    'job_title', v_job_title,
    'permissions', v_permissions,
    'can_enter', v_master or v_admin or v_status = 'active'
  );
end;
$$;
revoke all on function public.iqzodiac_admin_my_access() from public, anon;
grant execute on function public.iqzodiac_admin_my_access() to authenticated;

create or replace function public.iqzodiac_admin_touch_employee_activity()
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_rows integer;
begin
  if auth.uid() is null then return false; end if;
  update public.iqzodiac_admin_employees
    set last_activity_at = now(), updated_at = updated_at
    where user_id = auth.uid() and status = 'active'
      and (last_activity_at is null or last_activity_at < now() - interval '5 minutes');
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;
revoke all on function public.iqzodiac_admin_touch_employee_activity() from public, anon;
grant execute on function public.iqzodiac_admin_touch_employee_activity() to authenticated;

create or replace function public.iqzodiac_admin_list_employees()
returns table (
  user_id uuid,
  email text,
  display_name text,
  handle text,
  job_title text,
  job_description text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  last_activity_at timestamptz,
  permissions jsonb
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
begin
  if not public.salon_is_owner() then raise exception 'master_admin_required' using errcode = '42501'; end if;
  return query
    select e.user_id, u.email::text, pr.display_name, pr.handle,
           e.job_title, e.job_description, e.status, e.created_at, e.updated_at, e.last_activity_at,
           coalesce((
             select jsonb_agg(jsonb_build_object('module_key', p.module_key, 'permission_key', p.permission_key)
                              order by p.module_key, p.permission_key)
             from public.iqzodiac_admin_employee_permissions p where p.user_id = e.user_id
           ), '[]'::jsonb)
    from public.iqzodiac_admin_employees e
    join auth.users u on u.id = e.user_id
    left join public.profiles pr on pr.user_id = e.user_id
    order by case e.status when 'active' then 0 when 'suspended' then 1 else 2 end,
             e.updated_at desc
    limit 500;
end;
$$;
revoke all on function public.iqzodiac_admin_list_employees() from public, anon;
grant execute on function public.iqzodiac_admin_list_employees() to authenticated;

create or replace function public.iqzodiac_admin_save_employee(
  p_email text,
  p_job_title text,
  p_job_description text,
  p_permissions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user_id uuid;
  v_item jsonb;
  v_module text;
  v_permission text;
  v_modules text[] := array[
    'news_articles', 'posts_feed', 'reels_videos', 'discover_match',
    'members_profiles', 'marketplace', 'reports_moderation', 'live_audio',
    'website_pages_content', 'website_menus'
  ];
  v_permissions text[] := array[
    'view', 'create', 'edit', 'publish', 'unpublish', 'delete', 'moderate', 'manage_settings'
  ];
  v_grant_count integer := 0;
  v_scoped jsonb;
begin
  if not public.salon_is_owner() then raise exception 'master_admin_required' using errcode = '42501'; end if;
  if char_length(v_email) not between 5 and 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_job_title, ''))) not between 1 and 120
     or char_length(coalesce(p_job_description, '')) > 1000 then
    raise exception 'invalid_employee_job_details' using errcode = '22023';
  end if;
  if jsonb_typeof(p_permissions) <> 'array' or jsonb_array_length(p_permissions) < 1 or jsonb_array_length(p_permissions) > 10 then
    raise exception 'invalid_employee_permissions' using errcode = '22023';
  end if;
  select u.id into v_user_id from auth.users u
   where lower(u.email) = v_email and u.email_confirmed_at is not null limit 1;
  if v_user_id is null then raise exception 'confirmed_user_not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.salon_owner_roles r where r.user_id = v_user_id and r.role = 'owner') then
    raise exception 'master_admin_cannot_be_employee' using errcode = '42501';
  end if;

  for v_item in select value from jsonb_array_elements(p_permissions) as x(value) loop
    v_module := v_item->>'module_key';
    if v_module is null or not (v_module = any(v_modules))
       or jsonb_typeof(v_item->'permissions') <> 'array' then
      raise exception 'invalid_employee_permissions' using errcode = '22023';
    end if;
    for v_permission in select jsonb_array_elements_text(v_item->'permissions') loop
      if not (v_permission = any(v_permissions)) then
        raise exception 'invalid_employee_permissions' using errcode = '22023';
      end if;
      v_grant_count := v_grant_count + 1;
    end loop;
  end loop;
  if v_grant_count = 0 then raise exception 'employee_requires_explicit_permission' using errcode = '22023'; end if;

  insert into public.iqzodiac_admin_employees(user_id, job_title, job_description, status, created_by, updated_by)
  values (v_user_id, trim(p_job_title), coalesce(p_job_description, ''), 'active', auth.uid(), auth.uid())
  on conflict (user_id) do update set
    job_title = excluded.job_title,
    job_description = excluded.job_description,
    status = 'active', updated_by = auth.uid(), updated_at = now();

  delete from public.iqzodiac_admin_employee_permissions where user_id = v_user_id;
  for v_item in select value from jsonb_array_elements(p_permissions) as x(value) loop
    v_module := v_item->>'module_key';
    for v_permission in select distinct jsonb_array_elements_text(v_item->'permissions') loop
      insert into public.iqzodiac_admin_employee_permissions(user_id, module_key, permission_key, granted_by)
      values (v_user_id, v_module, v_permission, auth.uid())
      on conflict (user_id, module_key, permission_key) do nothing;
    end loop;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('module_key', p.module_key, 'permission_key', p.permission_key)
                            order by p.module_key, p.permission_key), '[]'::jsonb)
    into v_scoped from public.iqzodiac_admin_employee_permissions p where p.user_id = v_user_id;
  insert into public.vip_admin_audit_log(actor_user_id, action_code, entity_type, entity_id, metadata)
  values (auth.uid(), 'save_admin_employee', 'admin_employee', v_user_id,
          jsonb_build_object('email', v_email, 'job_title', trim(p_job_title), 'permissions', v_scoped));
  return jsonb_build_object('user_id', v_user_id, 'email', v_email, 'status', 'active');
end;
$$;
revoke all on function public.iqzodiac_admin_save_employee(text, text, text, jsonb) from public, anon;
grant execute on function public.iqzodiac_admin_save_employee(text, text, text, jsonb) to authenticated;

create or replace function public.iqzodiac_admin_set_employee_status(p_user_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_status text := lower(trim(coalesce(p_status, '')));
begin
  if not public.salon_is_owner() then raise exception 'master_admin_required' using errcode = '42501'; end if;
  if p_user_id is null or v_status not in ('active', 'suspended', 'revoked') then
    raise exception 'invalid_employee_status' using errcode = '22023';
  end if;
  if exists (select 1 from public.salon_owner_roles r where r.user_id = p_user_id and r.role = 'owner') then
    raise exception 'master_admin_cannot_be_modified' using errcode = '42501';
  end if;
  update public.iqzodiac_admin_employees
    set status = v_status, updated_by = auth.uid(), updated_at = now()
    where user_id = p_user_id;
  if not found then raise exception 'employee_not_found' using errcode = 'P0002'; end if;
  if v_status = 'revoked' then
    delete from public.iqzodiac_admin_employee_permissions where user_id = p_user_id;
  end if;
  insert into public.vip_admin_audit_log(actor_user_id, action_code, entity_type, entity_id, metadata)
  values (auth.uid(), v_status || '_admin_employee', 'admin_employee', p_user_id, jsonb_build_object('status', v_status));
  return true;
end;
$$;
revoke all on function public.iqzodiac_admin_set_employee_status(uuid, text) from public, anon;
grant execute on function public.iqzodiac_admin_set_employee_status(uuid, text) to authenticated;

create or replace function public.iqzodiac_admin_my_activity(p_limit integer default 80)
returns table (
  actor_user_id uuid,
  action_code text,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 80), 200));
  v_full boolean;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  v_full := coalesce(public.salon_is_owner(), false) or coalesce(public.iqzodiac_is_admin(), false);
  if not v_full and not exists (
    select 1 from public.iqzodiac_admin_employees e where e.user_id = v_user_id and e.status = 'active'
  ) then raise exception 'admin_or_employee_required' using errcode = '42501'; end if;
  return query
    with events as (
      select a.actor_user_id, a.action_code, a.entity_type, a.entity_id, a.metadata, a.created_at
      from public.vip_admin_audit_log a
      where v_full or a.actor_user_id = v_user_id
      union all
      select a.actor_user_id, a.action_code, a.entity_type, a.entity_id,
             jsonb_build_object('before', a.before_data, 'after', a.after_data), a.created_at
      from public.site_content_audit_log a
      where v_full or a.actor_user_id = v_user_id
    )
    select e.actor_user_id, e.action_code, e.entity_type, e.entity_id, e.metadata, e.created_at
    from events e order by e.created_at desc limit v_limit;
end;
$$;
revoke all on function public.iqzodiac_admin_my_activity(integer) from public, anon;
grant execute on function public.iqzodiac_admin_my_activity(integer) to authenticated;

-- This audit RPC records the authenticated actor and permits staff logging only for their module.
create or replace function public.iqzodiac_admin_audit(p_action_code text, p_entity_type text, p_entity_id uuid default null, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_module text;
  v_entity text := lower(trim(coalesce(p_entity_type, '')));
  v_has_write_permission boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if coalesce(public.salon_is_owner(), false) or coalesce(public.iqzodiac_is_admin(), false) then
    v_module := null;
  else
    v_module := case
      when v_entity in ('site_menu', 'site_menu_item') then 'website_menus'
      when v_entity in ('site_page', 'site_pages') then 'website_pages_content'
      when v_entity in ('profile', 'member_profile') then 'members_profiles'
      when v_entity in ('posts', 'post', 'comments', 'comment') then 'posts_feed'
      when v_entity in ('reels', 'reel', 'reel_comments', 'reel_comment', 'video_category') then 'reels_videos'
      when v_entity in ('marketplace_category', 'marketplace_categories', 'marketplace_listing', 'marketplace_order') then 'marketplace'
      when v_entity in ('marketplace_report', 'vip_live_report') then 'reports_moderation'
      when v_entity in ('discover_news_article', 'discover_news_source') then 'news_articles'
      when v_entity in ('audio_room', 'live_session') then 'live_audio'
      else null
    end;
    if v_module is null then raise exception 'admin_module_permission_required' using errcode = '42501'; end if;
    select exists (
      select 1 from unnest(array['create','edit','publish','unpublish','delete','moderate','manage_settings']::text[]) as a(action)
      where public.iqzodiac_admin_has_module_permission(v_module, a.action)
    ) into v_has_write_permission;
    if not v_has_write_permission then raise exception 'admin_module_permission_required' using errcode = '42501'; end if;
  end if;
  if char_length(trim(coalesce(p_action_code, ''))) not between 2 and 120
     or char_length(v_entity) not between 2 and 120
     or jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object'
     or pg_column_size(coalesce(p_metadata, '{}'::jsonb)) > 8192 then
    raise exception 'invalid_admin_audit_payload' using errcode = '22023';
  end if;
  insert into public.vip_admin_audit_log(actor_user_id, action_code, entity_type, entity_id, metadata)
  values (auth.uid(), trim(p_action_code), v_entity, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;
revoke all on function public.iqzodiac_admin_audit(text, text, uuid, jsonb) from public, anon;
grant execute on function public.iqzodiac_admin_audit(text, text, uuid, jsonb) to authenticated;

-- Module-scoped profile updates; staff cannot update other profile columns through PostgREST.
create or replace function public.iqzodiac_admin_update_member_profile(
  p_user_id uuid, p_display_name text, p_handle text, p_preferred_language text
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v public.profiles;
  v_name text := trim(coalesce(p_display_name, ''));
  v_handle text := trim(both '@' from trim(coalesce(p_handle, '')));
  v_language text := lower(trim(coalesce(p_preferred_language, '')));
begin
  if not public.iqzodiac_admin_has_module_permission('members_profiles', 'edit') then
    raise exception 'members_profiles_edit_required' using errcode = '42501';
  end if;
  if p_user_id is null or char_length(v_name) not between 1 and 80
     or char_length(v_handle) not between 1 and 24 or v_language not in ('en','ar') then
    raise exception 'invalid_member_profile_data' using errcode = '22023';
  end if;
  update public.profiles set display_name = v_name, handle = '@' || v_handle, preferred_language = v_language
    where user_id = p_user_id returning * into v;
  if not found then raise exception 'member_profile_not_found' using errcode = 'P0002'; end if;
  insert into public.vip_admin_audit_log(actor_user_id, action_code, entity_type, entity_id, metadata)
  values (auth.uid(), 'update_profile', 'profile', p_user_id,
          jsonb_build_object('display_name', v.display_name, 'handle', v.handle, 'preferred_language', v.preferred_language));
  return v;
end;
$$;
revoke all on function public.iqzodiac_admin_update_member_profile(uuid, text, text, text) from public, anon;
grant execute on function public.iqzodiac_admin_update_member_profile(uuid, text, text, text) to authenticated;

-- Public structure metadata; defaults preserve current rendered sections and pages.
alter table public.site_pages
  add column if not exists icon_key text not null default '' check (icon_key = '' or icon_key ~ '^[a-z0-9-]{1,40}$'),
  add column if not exists is_active boolean not null default true,
  add column if not exists is_visible boolean not null default true,
  add column if not exists access_level text not null default 'public' check (access_level in ('public', 'members', 'admin')),
  add column if not exists parent_id uuid references public.site_pages(id) on delete set null;
create index if not exists site_pages_parent_order_idx on public.site_pages(parent_id, sort_order, title_en);
grant insert (icon_key, is_active, is_visible, access_level, parent_id) on public.site_pages to authenticated;
grant update (icon_key, is_active, is_visible, access_level, parent_id) on public.site_pages to authenticated;

alter table public.site_menus
  add column if not exists visible_desktop boolean not null default true,
  add column if not exists visible_mobile boolean not null default true;

create or replace function public.iqzodiac_admin_has_site_page_access(p_action text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select public.iqzodiac_admin_has_module_permission('website_pages_content', p_action);
$$;
revoke all on function public.iqzodiac_admin_has_site_page_access(text) from public, anon;
grant execute on function public.iqzodiac_admin_has_site_page_access(text) to authenticated;

create or replace function public.iqzodiac_enforce_site_page_employee_permissions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_has_legacy_scope boolean := false;
  v_is_structural boolean := false;
begin
  if coalesce(public.iqzodiac_is_admin(), false) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'DELETE' then
    if public.iqzodiac_admin_has_module_permission('website_pages_content', 'delete') then return old; end if;
    raise exception 'site_page_delete_permission_required' using errcode = '42501';
  end if;
  v_has_legacy_scope := public.iqzodiac_can_manage_site_page(new.content_type, new.display_location);
  v_is_structural := tg_op = 'UPDATE' and (
    new.sort_order is distinct from old.sort_order
    or new.content_type is distinct from old.content_type
    or new.display_location is distinct from old.display_location
    or new.icon_key is distinct from old.icon_key
    or new.is_active is distinct from old.is_active
    or new.is_visible is distinct from old.is_visible
    or new.access_level is distinct from old.access_level
    or new.parent_id is distinct from old.parent_id
  );
  if v_has_legacy_scope then
    if v_is_structural and not public.iqzodiac_admin_has_module_permission('website_pages_content', 'manage_settings') then
      raise exception 'site_page_settings_permission_required' using errcode = '42501';
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not public.iqzodiac_admin_has_module_permission('website_pages_content', 'create') then
      raise exception 'site_page_create_permission_required' using errcode = '42501';
    end if;
    if new.is_published and not public.iqzodiac_admin_has_module_permission('website_pages_content', 'publish') then
      raise exception 'site_page_publish_permission_required' using errcode = '42501';
    end if;
    return new;
  end if;
  if v_is_structural and not public.iqzodiac_admin_has_module_permission('website_pages_content', 'manage_settings') then
    raise exception 'site_page_settings_permission_required' using errcode = '42501';
  end if;
  if (new.slug is distinct from old.slug or new.title_en is distinct from old.title_en
      or new.title_ar is distinct from old.title_ar or new.body_en is distinct from old.body_en
      or new.body_ar is distinct from old.body_ar)
     and not public.iqzodiac_admin_has_module_permission('website_pages_content', 'edit') then
    raise exception 'site_page_edit_permission_required' using errcode = '42501';
  end if;
  if new.is_published is distinct from old.is_published then
    if new.is_published and not public.iqzodiac_admin_has_module_permission('website_pages_content', 'publish') then
      raise exception 'site_page_publish_permission_required' using errcode = '42501';
    elsif not new.is_published and not public.iqzodiac_admin_has_module_permission('website_pages_content', 'unpublish') then
      raise exception 'site_page_unpublish_permission_required' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.iqzodiac_enforce_site_page_employee_permissions() from public, anon, authenticated;
drop trigger if exists site_pages_enforce_employee_permissions on public.site_pages;
create trigger site_pages_enforce_employee_permissions
  before insert or update or delete on public.site_pages
  for each row execute function public.iqzodiac_enforce_site_page_employee_permissions();

-- Preserve legacy scoped editors; add independent employee view and write policies.
drop policy if exists site_pages_public_or_manager_read on public.site_pages;
create policy site_pages_public_or_manager_read on public.site_pages
  for select to anon, authenticated
  using (
    (is_published and is_active and is_visible and (
      access_level = 'public'
      or (access_level = 'members' and auth.uid() is not null)
      or (access_level = 'admin' and public.iqzodiac_is_admin())
    ))
    or public.iqzodiac_can_manage_site_page(content_type, display_location)
    or public.iqzodiac_admin_has_module_permission('website_pages_content', 'view')
  );
drop policy if exists site_pages_employee_insert on public.site_pages;
create policy site_pages_employee_insert on public.site_pages
  for insert to authenticated
  with check (public.iqzodiac_admin_has_module_permission('website_pages_content', 'create'));
drop policy if exists site_pages_employee_update on public.site_pages;
create policy site_pages_employee_update on public.site_pages
  for update to authenticated
  using (
    public.iqzodiac_admin_has_module_permission('website_pages_content', 'edit')
    or public.iqzodiac_admin_has_module_permission('website_pages_content', 'publish')
    or public.iqzodiac_admin_has_module_permission('website_pages_content', 'unpublish')
    or public.iqzodiac_admin_has_module_permission('website_pages_content', 'manage_settings')
  )
  with check (
    public.iqzodiac_admin_has_module_permission('website_pages_content', 'edit')
    or public.iqzodiac_admin_has_module_permission('website_pages_content', 'publish')
    or public.iqzodiac_admin_has_module_permission('website_pages_content', 'unpublish')
    or public.iqzodiac_admin_has_module_permission('website_pages_content', 'manage_settings')
  );
drop policy if exists site_pages_employee_delete on public.site_pages;
create policy site_pages_employee_delete on public.site_pages
  for delete to authenticated using (public.iqzodiac_admin_has_module_permission('website_pages_content', 'delete'));

create or replace function public.iqzodiac_validate_site_page_parent()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_parent public.site_pages;
begin
  if new.parent_id is null then return new; end if;
  if new.content_type <> 'section' or new.parent_id = new.id then
    raise exception 'invalid_site_section_parent' using errcode = '22023';
  end if;
  select * into v_parent from public.site_pages p where p.id = new.parent_id;
  if not found or v_parent.content_type <> 'section' or v_parent.display_location <> new.display_location
     or v_parent.parent_id is not null then
    raise exception 'invalid_site_section_parent' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function public.iqzodiac_validate_site_page_parent() from public, anon, authenticated;
drop trigger if exists site_pages_validate_parent on public.site_pages;
create trigger site_pages_validate_parent before insert or update of parent_id, content_type, display_location
  on public.site_pages for each row execute function public.iqzodiac_validate_site_page_parent();

create or replace function public.iqzodiac_admin_enforce_menu_permissions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_table text := tg_table_name;
begin
  if coalesce(public.iqzodiac_is_admin(), false) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'DELETE' then
    if public.iqzodiac_admin_has_module_permission('website_menus', 'delete') then return old; end if;
    raise exception 'website_menu_delete_permission_required' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if not public.iqzodiac_admin_has_module_permission('website_menus', 'create') then
      raise exception 'website_menu_create_permission_required' using errcode = '42501';
    end if;
    return new;
  end if;
  if v_table = 'site_menus' then
    if (new.menu_key is distinct from old.menu_key or new.location is distinct from old.location
        or new.visible_desktop is distinct from old.visible_desktop
        or new.visible_mobile is distinct from old.visible_mobile)
       and not public.iqzodiac_admin_has_module_permission('website_menus', 'manage_settings') then
      raise exception 'website_menu_settings_permission_required' using errcode = '42501';
    end if;
    if (new.title_en is distinct from old.title_en or new.title_ar is distinct from old.title_ar
        or new.sort_order is distinct from old.sort_order)
       and not public.iqzodiac_admin_has_module_permission('website_menus', 'edit') then
      raise exception 'website_menu_edit_permission_required' using errcode = '42501';
    end if;
    if new.is_active is distinct from old.is_active then
      if new.is_active and not public.iqzodiac_admin_has_module_permission('website_menus', 'publish') then
        raise exception 'website_menu_publish_permission_required' using errcode = '42501';
      elsif not new.is_active and not public.iqzodiac_admin_has_module_permission('website_menus', 'unpublish') then
        raise exception 'website_menu_unpublish_permission_required' using errcode = '42501';
      end if;
    end if;
  else
    if (new.label_en is distinct from old.label_en or new.label_ar is distinct from old.label_ar
        or new.href is distinct from old.href or new.sort_order is distinct from old.sort_order)
       and not public.iqzodiac_admin_has_module_permission('website_menus', 'edit') then
      raise exception 'website_menu_item_edit_permission_required' using errcode = '42501';
    end if;
    if new.is_active is distinct from old.is_active then
      if new.is_active and not public.iqzodiac_admin_has_module_permission('website_menus', 'publish') then
        raise exception 'website_menu_item_publish_permission_required' using errcode = '42501';
      elsif not new.is_active and not public.iqzodiac_admin_has_module_permission('website_menus', 'unpublish') then
        raise exception 'website_menu_item_unpublish_permission_required' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.iqzodiac_admin_enforce_menu_permissions() from public, anon, authenticated;
drop trigger if exists site_menus_enforce_permissions on public.site_menus;
create trigger site_menus_enforce_permissions before insert or update or delete on public.site_menus
  for each row execute function public.iqzodiac_admin_enforce_menu_permissions();
drop trigger if exists site_menu_items_enforce_permissions on public.site_menu_items;
create trigger site_menu_items_enforce_permissions before insert or update or delete on public.site_menu_items
  for each row execute function public.iqzodiac_admin_enforce_menu_permissions();

drop policy if exists site_menus_public_read on public.site_menus;
create policy site_menus_public_read on public.site_menus
  for select to anon, authenticated
  using ((is_active and (visible_desktop or visible_mobile))
    or public.iqzodiac_admin_has_module_permission('website_menus', 'view'));
drop policy if exists site_menus_employee_insert on public.site_menus;
create policy site_menus_employee_insert on public.site_menus
  for insert to authenticated with check (public.iqzodiac_admin_has_module_permission('website_menus', 'create'));
drop policy if exists site_menus_employee_update on public.site_menus;
create policy site_menus_employee_update on public.site_menus
  for update to authenticated
  using (public.iqzodiac_admin_has_module_permission('website_menus', 'edit')
      or public.iqzodiac_admin_has_module_permission('website_menus', 'publish')
      or public.iqzodiac_admin_has_module_permission('website_menus', 'unpublish')
      or public.iqzodiac_admin_has_module_permission('website_menus', 'manage_settings'))
  with check (public.iqzodiac_admin_has_module_permission('website_menus', 'edit')
      or public.iqzodiac_admin_has_module_permission('website_menus', 'publish')
      or public.iqzodiac_admin_has_module_permission('website_menus', 'unpublish')
      or public.iqzodiac_admin_has_module_permission('website_menus', 'manage_settings'));
drop policy if exists site_menus_employee_delete on public.site_menus;
create policy site_menus_employee_delete on public.site_menus
  for delete to authenticated using (public.iqzodiac_admin_has_module_permission('website_menus', 'delete'));

drop policy if exists site_menu_items_public_read on public.site_menu_items;
create policy site_menu_items_public_read on public.site_menu_items
  for select to anon, authenticated
  using ((is_active and exists (
      select 1 from public.site_menus m where m.id = menu_id and m.is_active and (m.visible_desktop or m.visible_mobile)
    )) or public.iqzodiac_admin_has_module_permission('website_menus', 'view'));
drop policy if exists site_menu_items_employee_insert on public.site_menu_items;
create policy site_menu_items_employee_insert on public.site_menu_items
  for insert to authenticated with check (public.iqzodiac_admin_has_module_permission('website_menus', 'create'));
drop policy if exists site_menu_items_employee_update on public.site_menu_items;
create policy site_menu_items_employee_update on public.site_menu_items
  for update to authenticated
  using (public.iqzodiac_admin_has_module_permission('website_menus', 'edit')
      or public.iqzodiac_admin_has_module_permission('website_menus', 'publish')
      or public.iqzodiac_admin_has_module_permission('website_menus', 'unpublish'))
  with check (public.iqzodiac_admin_has_module_permission('website_menus', 'edit')
      or public.iqzodiac_admin_has_module_permission('website_menus', 'publish')
      or public.iqzodiac_admin_has_module_permission('website_menus', 'unpublish'));
drop policy if exists site_menu_items_employee_delete on public.site_menu_items;
create policy site_menu_items_employee_delete on public.site_menu_items
  for delete to authenticated using (public.iqzodiac_admin_has_module_permission('website_menus', 'delete'));

create or replace function public.iqzodiac_admin_list_menu_targets()
returns table (id uuid, title_en text, title_ar text, href text)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if not (public.iqzodiac_admin_has_module_permission('website_menus', 'create')
       or public.iqzodiac_admin_has_module_permission('website_menus', 'edit')
       or public.iqzodiac_admin_has_module_permission('website_menus', 'manage_settings')) then
    raise exception 'website_menu_edit_permission_required' using errcode = '42501';
  end if;
  return query
    select p.id, p.title_en, p.title_ar,
      case when p.content_type = 'page'
        then './site-pages.html?slug=' || p.slug
        else
          case p.display_location
            when 'home' then './home.html#managed-site-section-' || p.slug
            when 'discover' then './discover.html#managed-site-section-' || p.slug
            when 'marketplace' then './marketplace.html#managed-site-section-' || p.slug
            when 'profile' then './profile.html#managed-site-section-' || p.slug
            else './site-pages.html?slug=' || p.slug
          end
      end as href
    from public.site_pages p
    where p.is_published and p.is_active and p.is_visible
    order by p.display_location, p.sort_order, p.title_en
    limit 300;
end;
$$;
revoke all on function public.iqzodiac_admin_list_menu_targets() from public, anon;
grant execute on function public.iqzodiac_admin_list_menu_targets() to authenticated;

create or replace function public.iqzodiac_admin_reorder_site_menus(p_menu_ids uuid[])
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_updated integer;
begin
  if not public.iqzodiac_admin_has_module_permission('website_menus', 'edit') then
    raise exception 'website_menu_edit_permission_required' using errcode = '42501';
  end if;
  if p_menu_ids is null or cardinality(p_menu_ids) < 1 or cardinality(p_menu_ids) > 100 then
    raise exception 'invalid_menu_order' using errcode = '22023';
  end if;
  update public.site_menus m set sort_order = (ordered.ordinality - 1) * 10
    from unnest(p_menu_ids) with ordinality as ordered(id, ordinality)
    where m.id = ordered.id;
  get diagnostics v_updated = row_count;
  if v_updated <> cardinality(p_menu_ids) then raise exception 'invalid_menu_order' using errcode = '22023'; end if;
  return true;
end;
$$;
revoke all on function public.iqzodiac_admin_reorder_site_menus(uuid[]) from public, anon;
grant execute on function public.iqzodiac_admin_reorder_site_menus(uuid[]) to authenticated;

create or replace function public.iqzodiac_admin_reorder_site_menu_items(p_menu_id uuid, p_item_ids uuid[])
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_updated integer;
begin
  if not public.iqzodiac_admin_has_module_permission('website_menus', 'edit') then
    raise exception 'website_menu_edit_permission_required' using errcode = '42501';
  end if;
  if p_menu_id is null or p_item_ids is null or cardinality(p_item_ids) < 1 or cardinality(p_item_ids) > 300 then
    raise exception 'invalid_menu_item_order' using errcode = '22023';
  end if;
  update public.site_menu_items i set sort_order = (ordered.ordinality - 1) * 10
    from unnest(p_item_ids) with ordinality as ordered(id, ordinality)
    where i.id = ordered.id and i.menu_id = p_menu_id;
  get diagnostics v_updated = row_count;
  if v_updated <> cardinality(p_item_ids) then raise exception 'invalid_menu_item_order' using errcode = '22023'; end if;
  return true;
end;
$$;
revoke all on function public.iqzodiac_admin_reorder_site_menu_items(uuid, uuid[]) from public, anon;
grant execute on function public.iqzodiac_admin_reorder_site_menu_items(uuid, uuid[]) to authenticated;

create or replace function public.iqzodiac_audit_site_menu_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_row jsonb;
  v_id uuid;
  v_entity text := case when tg_table_name = 'site_menus' then 'site_menu' else 'site_menu_item' end;
  v_action text;
begin
  if tg_op = 'DELETE' then v_row := to_jsonb(old); v_id := old.id;
  else v_row := to_jsonb(new); v_id := new.id;
  end if;
  v_action := lower(case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end) || '_' || v_entity;
  insert into public.vip_admin_audit_log(actor_user_id, action_code, entity_type, entity_id, metadata)
  values (auth.uid(), v_action, v_entity, v_id,
          jsonb_build_object('menu_id', v_row->>'menu_id', 'location', v_row->>'location',
                             'sort_order', v_row->>'sort_order', 'is_active', v_row->>'is_active'));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.iqzodiac_audit_site_menu_change() from public, anon, authenticated;
drop trigger if exists site_menus_audit_change on public.site_menus;
create trigger site_menus_audit_change after insert or update or delete on public.site_menus
  for each row execute function public.iqzodiac_audit_site_menu_change();
drop trigger if exists site_menu_items_audit_change on public.site_menu_items;
create trigger site_menu_items_audit_change after insert or update or delete on public.site_menu_items
  for each row execute function public.iqzodiac_audit_site_menu_change();

-- Existing public navigation records remain unchanged; device flags default to visible.
drop policy if exists vip_admin_audit_read_employee_own on public.vip_admin_audit_log;
create policy vip_admin_audit_read_employee_own on public.vip_admin_audit_log
  for select to authenticated using (actor_user_id = auth.uid());

-- Staff can read assigned areas and moderate only through their explicit module grant.
drop policy if exists profiles_employee_read on public.profiles;
create policy profiles_employee_read on public.profiles
  for select to authenticated using (public.iqzodiac_admin_has_module_permission('members_profiles', 'view'));

drop policy if exists posts_employee_read on public.posts;
create policy posts_employee_read on public.posts
  for select to authenticated using (public.iqzodiac_admin_has_module_permission('posts_feed', 'view'));
drop policy if exists posts_employee_delete on public.posts;
create policy posts_employee_delete on public.posts
  for delete to authenticated using (
    public.iqzodiac_admin_has_module_permission('posts_feed', 'delete')
    or public.iqzodiac_admin_has_module_permission('posts_feed', 'moderate')
  );
drop policy if exists comments_employee_read on public.comments;
create policy comments_employee_read on public.comments
  for select to authenticated using (public.iqzodiac_admin_has_module_permission('posts_feed', 'view'));
drop policy if exists comments_employee_delete on public.comments;
create policy comments_employee_delete on public.comments
  for delete to authenticated using (
    public.iqzodiac_admin_has_module_permission('posts_feed', 'delete')
    or public.iqzodiac_admin_has_module_permission('posts_feed', 'moderate')
  );
drop policy if exists reel_comments_employee_read on public.reel_comments;
create policy reel_comments_employee_read on public.reel_comments
  for select to authenticated using (public.iqzodiac_admin_has_module_permission('reels_videos', 'view'));
drop policy if exists reel_comments_employee_delete on public.reel_comments;
create policy reel_comments_employee_delete on public.reel_comments
  for delete to authenticated using (
    public.iqzodiac_admin_has_module_permission('reels_videos', 'delete')
    or public.iqzodiac_admin_has_module_permission('reels_videos', 'moderate')
  );
drop policy if exists reels_employee_read on public.reels;
create policy reels_employee_read on public.reels
  for select to authenticated using (public.iqzodiac_admin_has_module_permission('reels_videos', 'view'));
drop policy if exists reels_employee_delete on public.reels;
create policy reels_employee_delete on public.reels
  for delete to authenticated using (
    public.iqzodiac_admin_has_module_permission('reels_videos', 'delete')
    or public.iqzodiac_admin_has_module_permission('reels_videos', 'moderate')
  );
drop policy if exists iqzodiac_media_employee_delete on storage.objects;
create policy iqzodiac_media_employee_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'iqzodiac-media'
    and (public.iqzodiac_admin_has_module_permission('reels_videos', 'delete')
      or public.iqzodiac_admin_has_module_permission('reels_videos', 'moderate'))
  );

-- Marketplace and report access are separate; employee order access remains unavailable.
drop policy if exists marketplace_categories_employee_read on public.marketplace_categories;
create policy marketplace_categories_employee_read on public.marketplace_categories
  for select to authenticated using (public.iqzodiac_admin_has_module_permission('marketplace', 'view'));
drop policy if exists marketplace_categories_employee_insert on public.marketplace_categories;
create policy marketplace_categories_employee_insert on public.marketplace_categories
  for insert to authenticated with check (public.iqzodiac_admin_has_module_permission('marketplace', 'create'));
drop policy if exists marketplace_categories_employee_update on public.marketplace_categories;
create policy marketplace_categories_employee_update on public.marketplace_categories
  for update to authenticated
  using (public.iqzodiac_admin_has_module_permission('marketplace', 'edit')
      or public.iqzodiac_admin_has_module_permission('marketplace', 'publish')
      or public.iqzodiac_admin_has_module_permission('marketplace', 'unpublish'))
  with check (public.iqzodiac_admin_has_module_permission('marketplace', 'edit')
      or public.iqzodiac_admin_has_module_permission('marketplace', 'publish')
      or public.iqzodiac_admin_has_module_permission('marketplace', 'unpublish'));
drop policy if exists marketplace_listings_employee_read on public.marketplace_listings;
create policy marketplace_listings_employee_read on public.marketplace_listings
  for select to authenticated using (public.iqzodiac_admin_has_module_permission('marketplace', 'view'));
drop policy if exists marketplace_listings_employee_update on public.marketplace_listings;
create policy marketplace_listings_employee_update on public.marketplace_listings
  for update to authenticated using (public.iqzodiac_admin_has_module_permission('marketplace', 'edit'))
  with check (public.iqzodiac_admin_has_module_permission('marketplace', 'edit'));
drop policy if exists marketplace_listings_employee_delete on public.marketplace_listings;
create policy marketplace_listings_employee_delete on public.marketplace_listings
  for delete to authenticated using (public.iqzodiac_admin_has_module_permission('marketplace', 'delete'));
drop policy if exists marketplace_reports_employee_read on public.marketplace_reports;
create policy marketplace_reports_employee_read on public.marketplace_reports
  for select to authenticated using (public.iqzodiac_admin_has_module_permission('reports_moderation', 'view'));
drop policy if exists marketplace_reports_employee_update on public.marketplace_reports;
create policy marketplace_reports_employee_update on public.marketplace_reports
  for update to authenticated using (
    public.iqzodiac_admin_has_module_permission('reports_moderation', 'moderate')
    or public.iqzodiac_admin_has_module_permission('reports_moderation', 'edit')
  ) with check (
    public.iqzodiac_admin_has_module_permission('reports_moderation', 'moderate')
    or public.iqzodiac_admin_has_module_permission('reports_moderation', 'edit')
  );

drop policy if exists video_categories_employee_read on public.video_categories;
create policy video_categories_employee_read on public.video_categories
  for select to authenticated using (public.iqzodiac_admin_has_module_permission('reels_videos', 'view'));
drop policy if exists video_categories_employee_insert on public.video_categories;
create policy video_categories_employee_insert on public.video_categories
  for insert to authenticated with check (public.iqzodiac_admin_has_module_permission('reels_videos', 'create'));
drop policy if exists video_categories_employee_update on public.video_categories;
create policy video_categories_employee_update on public.video_categories
  for update to authenticated
  using (public.iqzodiac_admin_has_module_permission('reels_videos', 'edit')
      or public.iqzodiac_admin_has_module_permission('reels_videos', 'publish')
      or public.iqzodiac_admin_has_module_permission('reels_videos', 'unpublish'))
  with check (public.iqzodiac_admin_has_module_permission('reels_videos', 'edit')
      or public.iqzodiac_admin_has_module_permission('reels_videos', 'publish')
      or public.iqzodiac_admin_has_module_permission('reels_videos', 'unpublish'));

-- Additional history policy for a master owner who is not a legacy/VIP administrator.
drop policy if exists vip_admin_audit_master_read on public.vip_admin_audit_log;
create policy vip_admin_audit_master_read on public.vip_admin_audit_log
  for select to authenticated using (public.salon_is_owner());
