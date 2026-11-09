-- Allow authors to remove the media attached to their own Feed posts.
drop policy if exists iqzodiac_post_media_delete on storage.objects;
create policy iqzodiac_post_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'iqzodiac-media'
    and exists (
      select 1
      from public.posts p
      where p.author_id = auth.uid()
        and p.media_path = storage.objects.name
        and p.media_path is not null
    )
  );
