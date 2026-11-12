-- Additive profile gallery upgrade: categories, previews, sale metadata, and purchase authorization.
-- Existing profile_media rows remain valid and are treated as public/private from is_public.

alter table public.profile_media
  add column if not exists gallery_section text not null default 'private',
  add column if not exists description text not null default '',
  add column if not exists sale_price numeric(12,2),
  add column if not exists currency_code text not null default 'USD',
  add column if not exists sale_active boolean not null default false,
  add column if not exists preview_storage_path text;

update public.profile_media
set gallery_section = case when is_public then 'public' else 'private' end
where gallery_section is null or gallery_section = '';

alter table public.profile_media drop constraint if exists profile_media_gallery_section_check;
alter table public.profile_media add constraint profile_media_gallery_section_check check (gallery_section in ('public','private','sale'));
alter table public.profile_media drop constraint if exists profile_media_sale_price_check;
alter table public.profile_media add constraint profile_media_sale_price_check check (sale_price is null or sale_price >= 0);
alter table public.profile_media drop constraint if exists profile_media_currency_code_check;
alter table public.profile_media add constraint profile_media_currency_code_check check (currency_code ~ '^[A-Z]{3}$');
create index if not exists profile_media_gallery_section_idx on public.profile_media (user_id, gallery_section, created_at desc);
create index if not exists profile_media_sale_active_idx on public.profile_media (gallery_section, sale_active) where gallery_section = 'sale' and sale_active;

create table if not exists public.profile_media_purchases (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.profile_media(id) on delete cascade,
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  seller_user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  payment_provider text,
  provider_reference text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (media_id, buyer_user_id)
);

alter table public.profile_media_purchases enable row level security;
alter table public.profile_media_purchases force row level security;
revoke all on table public.profile_media_purchases from anon, authenticated;
grant select, insert on table public.profile_media_purchases to authenticated;

drop policy if exists profile_media_purchases_select on public.profile_media_purchases;
create policy profile_media_purchases_select on public.profile_media_purchases
  for select to authenticated
  using (buyer_user_id = auth.uid() or seller_user_id = auth.uid() or public.iqzodiac_is_admin());

drop policy if exists profile_media_purchases_insert on public.profile_media_purchases;
create policy profile_media_purchases_insert on public.profile_media_purchases
  for insert to authenticated
  with check (buyer_user_id = auth.uid() and buyer_user_id <> seller_user_id and status = 'pending');

-- Metadata is visible to authenticated visitors for active sale listings, but originals remain private.
drop policy if exists profile_media_owner_read on public.profile_media;
create policy profile_media_owner_read on public.profile_media
  for select to authenticated
  using (
    user_id = auth.uid()
    or (gallery_section = 'public' and is_public and exists (
      select 1 from public.profiles p
      where p.user_id = profile_media.user_id
        and coalesce((p.privacy->>'photosPublic')::boolean, false)
    ))
    or (gallery_section = 'sale' and sale_active)
    or public.iqzodiac_is_admin()
  );

drop policy if exists profile_media_owner_update on public.profile_media;
create policy profile_media_owner_update on public.profile_media
  for update to authenticated
  using (user_id = auth.uid() or public.iqzodiac_is_admin())
  with check (user_id = auth.uid() or public.iqzodiac_is_admin());

-- Keep private originals protected; allow public originals only for public items and paid sale originals.
drop policy if exists iqzodiac_media_owner_read on storage.objects;
create policy iqzodiac_media_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'iqzodiac-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.profile_media m
        join public.profiles p on p.user_id = m.user_id
        where m.storage_path = storage.objects.name
          and m.gallery_section = 'public'
          and m.is_public
          and coalesce((p.privacy->>'photosPublic')::boolean, false)
      )
      or exists (
        select 1 from public.profile_media m
        join public.profile_media_purchases purchase on purchase.media_id = m.id
        where m.storage_path = storage.objects.name
          and purchase.buyer_user_id = auth.uid()
          and purchase.status = 'paid'
      )
      or exists (
        select 1 from public.profile_media m
        where m.preview_storage_path = storage.objects.name
          and m.gallery_section = 'sale'
          and m.sale_active
      )
      or public.iqzodiac_is_admin()
    )
  );

-- Prevent an uploaded preview/original from being placed under another user's folder.
drop policy if exists iqzodiac_media_owner_insert on storage.objects;
create policy iqzodiac_media_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'iqzodiac-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists iqzodiac_media_owner_delete on storage.objects;
create policy iqzodiac_media_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'iqzodiac-media' and ((storage.foldername(name))[1] = auth.uid()::text or public.iqzodiac_is_admin()));
