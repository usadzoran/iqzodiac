-- Additive private Vault media storage for Discover.
-- No existing table, bucket, row, or file is deleted or altered.
create table if not exists public.vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('image','video','audio')),
  mime_type text not null,
  original_name text not null default '',
  size_bytes bigint not null check (size_bytes between 1 and 104857600),
  created_at timestamptz not null default now(),
  check (storage_path = user_id::text || '/' || id::text || '/' || original_name)
);

create index if not exists vault_items_owner_created_idx
  on public.vault_items (user_id, created_at desc);

alter table public.vault_items enable row level security;
alter table public.vault_items force row level security;
revoke all on table public.vault_items from anon, authenticated;
grant select, insert, delete on table public.vault_items to authenticated;

drop policy if exists vault_items_owner_read on public.vault_items;
create policy vault_items_owner_read on public.vault_items
  for select to authenticated using (user_id = auth.uid());

drop policy if exists vault_items_owner_insert on public.vault_items;
create policy vault_items_owner_insert on public.vault_items
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists vault_items_owner_delete on public.vault_items;
create policy vault_items_owner_delete on public.vault_items
  for delete to authenticated using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'iqzodiac-vault-private',
  'iqzodiac-vault-private',
  false,
  104857600,
  array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
        'video/mp4','video/webm','video/quicktime','video/ogg',
        'audio/mpeg','audio/mp4','audio/wav','audio/ogg','audio/webm','audio/aac']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists vault_storage_owner_read on storage.objects;
create policy vault_storage_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'iqzodiac-vault-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists vault_storage_owner_insert on storage.objects;
create policy vault_storage_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'iqzodiac-vault-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists vault_storage_owner_delete on storage.objects;
create policy vault_storage_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'iqzodiac-vault-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
