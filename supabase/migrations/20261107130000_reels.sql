-- Short-form video publishing: one Reel is one video up to 60 seconds.
create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 280),
  media_path text not null,
  media_mime text not null check (media_mime like 'video/%'),
  media_size_bytes bigint not null check (media_size_bytes > 0 and media_size_bytes <= 52428800),
  duration_seconds numeric(7,3) not null check (duration_seconds > 0 and duration_seconds <= 60),
  created_at timestamptz not null default now()
);

create index if not exists reels_created_idx on public.reels(created_at desc);
create index if not exists reels_author_idx on public.reels(author_id, created_at desc);

alter table public.reels enable row level security;
alter table public.reels force row level security;
revoke all on table public.reels from anon, authenticated;
grant select, insert, update, delete on table public.reels to authenticated;

drop policy if exists reels_authenticated_read on public.reels;
create policy reels_authenticated_read on public.reels
  for select to authenticated using (true);

drop policy if exists reels_owner_insert on public.reels;
create policy reels_owner_insert on public.reels
  for insert to authenticated with check (auth.uid() = author_id);

drop policy if exists reels_owner_update on public.reels;
create policy reels_owner_update on public.reels
  for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists reels_owner_delete on public.reels;
create policy reels_owner_delete on public.reels
  for delete to authenticated using (auth.uid() = author_id);

-- Reels use the existing private iqzodiac-media bucket.
drop policy if exists iqzodiac_reels_read on storage.objects;
create policy iqzodiac_reels_read on storage.objects
  for select to authenticated using (
    bucket_id = 'iqzodiac-media'
    and exists (select 1 from public.reels r where r.media_path = storage.objects.name)
  );

drop policy if exists iqzodiac_reels_insert on storage.objects;
create policy iqzodiac_reels_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'iqzodiac-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] = 'reels'
  );

drop policy if exists iqzodiac_reels_update on storage.objects;
create policy iqzodiac_reels_update on storage.objects
  for update to authenticated using (
    bucket_id = 'iqzodiac-media' and (storage.foldername(name))[1] = auth.uid()::text and (storage.foldername(name))[2] = 'reels'
  ) with check (
    bucket_id = 'iqzodiac-media' and (storage.foldername(name))[1] = auth.uid()::text and (storage.foldername(name))[2] = 'reels'
  );

drop policy if exists iqzodiac_reels_delete on storage.objects;
create policy iqzodiac_reels_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'iqzodiac-media' and (storage.foldername(name))[1] = auth.uid()::text and (storage.foldername(name))[2] = 'reels'
  );
