-- Remove Supabase default table-level grants so column-level page edit grants are effective.
revoke all on table public.site_pages from anon, authenticated;
grant select on public.site_pages to anon, authenticated;
grant insert (slug, title_en, title_ar, body_en, body_ar, is_published, sort_order) on public.site_pages to authenticated;
grant update (slug, title_en, title_ar, body_en, body_ar, is_published, sort_order) on public.site_pages to authenticated;
