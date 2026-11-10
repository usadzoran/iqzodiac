-- Image metadata may only reference objects in the authenticated seller's
-- own <seller UUID>/<listing UUID>/ path. This prevents laundering another
-- user's Storage object through an otherwise public listing.
drop policy if exists marketplace_images_owner_write on public.marketplace_listing_images;
create policy marketplace_images_owner_write on public.marketplace_listing_images
  for all to authenticated
  using (
    exists (
      select 1
      from public.marketplace_listings l
      where l.id = marketplace_listing_images.listing_id
        and (l.seller_id = auth.uid() or public.iqzodiac_is_admin())
    )
  )
  with check (
    exists (
      select 1
      from public.marketplace_listings l
      where l.id = marketplace_listing_images.listing_id
        and (l.seller_id = auth.uid() or public.iqzodiac_is_admin())
    )
    and (
      public.iqzodiac_is_admin()
      or left(
        storage_path,
        length(auth.uid()::text || '/' || listing_id::text || '/')
      ) = auth.uid()::text || '/' || listing_id::text || '/'
    )
  );
