-- A soft-deleted listing must be hidden by RLS as well as by the UI query.
drop policy if exists marketplace_listings_public_read on public.marketplace_listings;
create policy marketplace_listings_public_read on public.marketplace_listings
  for select to authenticated
  using (
    (status = 'active' and deleted_at is null)
    or seller_id = auth.uid()
    or public.iqzodiac_is_admin()
  );

drop policy if exists marketplace_images_read on public.marketplace_listing_images;
create policy marketplace_images_read on public.marketplace_listing_images
  for select to authenticated
  using (
    exists (
      select 1
      from public.marketplace_listings l
      where l.id = marketplace_listing_images.listing_id
        and (
          (l.status = 'active' and l.deleted_at is null)
          or l.seller_id = auth.uid()
          or public.iqzodiac_is_admin()
        )
    )
  );

-- Scope Storage reads to the uploader/owner, admins, or images belonging to a
-- currently public listing; hiding a listing no longer leaves its images public.
drop policy if exists marketplace_storage_read on storage.objects;
create policy marketplace_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'marketplace-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.marketplace_listing_images i
        join public.marketplace_listings l on l.id = i.listing_id
        where i.storage_path = storage.objects.name
          and (
            (l.status = 'active' and l.deleted_at is null)
            or l.seller_id = auth.uid()
            or public.iqzodiac_is_admin()
          )
      )
    )
  );

-- Require an owned, live listing path for uploads so sellers cannot use the
-- marketplace bucket for arbitrary files.
drop policy if exists marketplace_storage_insert on storage.objects;
create policy marketplace_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'marketplace-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.marketplace_listings l
      where l.id::text = (storage.foldername(name))[2]
        and l.seller_id = auth.uid()
        and l.deleted_at is null
    )
  );

-- Deletion is limited to the owner of the listing encoded in the object path.
drop policy if exists marketplace_storage_delete on storage.objects;
create policy marketplace_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'marketplace-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.marketplace_listings l
      where l.id::text = (storage.foldername(name))[2]
        and l.seller_id = auth.uid()
    )
  );
