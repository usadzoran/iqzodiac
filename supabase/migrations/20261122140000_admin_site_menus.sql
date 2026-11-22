-- Admin-only site structure controls: page deletion and configurable menus.
create table if not exists public.site_menus (
  id uuid primary key default gen_random_uuid(),
  menu_key text not null unique check (menu_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(menu_key) <= 64),
  title_en text not null check (char_length(trim(title_en)) between 1 and 80),
  title_ar text not null check (char_length(trim(title_ar)) between 1 and 80),
  location text not null default 'custom' check (location in ('footer','header','custom')),
  is_active boolean not null default true,
  sort_order integer not null default 100 check (sort_order between 0 and 1000000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.site_menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.site_menus(id) on delete cascade,
  label_en text not null check (char_length(trim(label_en)) between 1 and 100),
  label_ar text not null check (char_length(trim(label_ar)) between 1 and 100),
  href text not null check (char_length(trim(href)) between 1 and 500 and href !~ '[[:space:][:cntrl:]]' and href !~* '^(javascript|data|vbscript):'),
  sort_order integer not null default 100 check (sort_order between 0 and 1000000),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists site_menu_items_menu_order_idx on public.site_menu_items(menu_id, sort_order, created_at);
create or replace function public.iqzodiac_touch_site_menu_updated_at()
returns trigger language plpgsql set search_path = public, pg_catalog as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists site_menus_touch_updated_at on public.site_menus;
create trigger site_menus_touch_updated_at before update on public.site_menus for each row execute function public.iqzodiac_touch_site_menu_updated_at();
drop trigger if exists site_menu_items_touch_updated_at on public.site_menu_items;
create trigger site_menu_items_touch_updated_at before update on public.site_menu_items for each row execute function public.iqzodiac_touch_site_menu_updated_at();
alter table public.site_menus enable row level security;
alter table public.site_menu_items enable row level security;
drop policy if exists site_menus_public_read on public.site_menus;
create policy site_menus_public_read on public.site_menus for select to anon, authenticated using (is_active or public.iqzodiac_is_admin());
drop policy if exists site_menus_admin_insert on public.site_menus;
create policy site_menus_admin_insert on public.site_menus for insert to authenticated with check (public.iqzodiac_is_admin());
drop policy if exists site_menus_admin_update on public.site_menus;
create policy site_menus_admin_update on public.site_menus for update to authenticated using (public.iqzodiac_is_admin()) with check (public.iqzodiac_is_admin());
drop policy if exists site_menus_admin_delete on public.site_menus;
create policy site_menus_admin_delete on public.site_menus for delete to authenticated using (public.iqzodiac_is_admin());
drop policy if exists site_menu_items_public_read on public.site_menu_items;
create policy site_menu_items_public_read on public.site_menu_items for select to anon, authenticated using (is_active and exists (select 1 from public.site_menus m where m.id = menu_id and m.is_active) or public.iqzodiac_is_admin());
drop policy if exists site_menu_items_admin_insert on public.site_menu_items;
create policy site_menu_items_admin_insert on public.site_menu_items for insert to authenticated with check (public.iqzodiac_is_admin());
drop policy if exists site_menu_items_admin_update on public.site_menu_items;
create policy site_menu_items_admin_update on public.site_menu_items for update to authenticated using (public.iqzodiac_is_admin()) with check (public.iqzodiac_is_admin());
drop policy if exists site_menu_items_admin_delete on public.site_menu_items;
create policy site_menu_items_admin_delete on public.site_menu_items for delete to authenticated using (public.iqzodiac_is_admin());
revoke all on public.site_menus, public.site_menu_items from anon, authenticated;
grant select on public.site_menus, public.site_menu_items to anon, authenticated;
grant insert, update, delete on public.site_menus, public.site_menu_items to authenticated;
grant delete on public.site_pages to authenticated;
drop policy if exists site_pages_admin_delete on public.site_pages;
create policy site_pages_admin_delete on public.site_pages for delete to authenticated using (public.iqzodiac_is_admin());
