-- Distinguish standalone visitor pages from reusable site sections and record their target area.
alter table public.site_pages
  add column if not exists content_type text not null default 'page',
  add column if not exists display_location text not null default 'pages';
update public.site_pages set content_type='page' where content_type is null;
update public.site_pages set display_location='pages' where display_location is null;
alter table public.site_pages drop constraint if exists site_pages_content_type_check;
alter table public.site_pages add constraint site_pages_content_type_check check (content_type in ('page','section'));
alter table public.site_pages drop constraint if exists site_pages_display_location_check;
alter table public.site_pages add constraint site_pages_display_location_check check (display_location in ('pages','home','discover','marketplace','profile'));
grant insert (slug,title_en,title_ar,body_en,body_ar,is_published,sort_order,content_type,display_location) on public.site_pages to authenticated;
grant update (slug,title_en,title_ar,body_en,body_ar,is_published,sort_order,content_type,display_location) on public.site_pages to authenticated;

-- Menus support distinct rendering positions; writes remain administrator-only via existing RLS.
alter table public.site_menus drop constraint if exists site_menus_location_check;
alter table public.site_menus add constraint site_menus_location_check check (location in ('footer','header','dropdown','user','side'));
