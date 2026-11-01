-- IQZodiac phase 2: private profile media, searchable location fields, and owner-only admin reads.
-- Additive only: no existing tables or data are deleted.

alter table public.profiles add column if not exists country text not null default '';
alter table public.profiles add column if not exists city text not null default '';
alter table public.profiles add column if not exists preferred_language text not null default 'en';
alter table public.profiles drop constraint if exists profiles_preferred_language_check;
alter table public.profiles add constraint profiles_preferred_language_check check (preferred_language in ('en', 'ar'));

create index if not exists profiles_country_city_idx on public.profiles (lower(country), lower(city));

create table if not exists public.profile_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('avatar', 'photo', 'video')),
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profile_media_user_created_idx on public.profile_media (user_id, created_at desc);
create index if not exists profile_media_public_idx on public.profile_media (is_public) where is_public;

alter table public.profile_media enable row level security;
alter table public.profile_media force row level security;
revoke all on table public.profile_media from anon, authenticated;
grant select, insert, update, delete on table public.profile_media to authenticated;

create or replace function public.iqzodiac_is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_catalog
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.salon_owner_roles r where r.user_id = auth.uid() and r.role = 'owner')
    or exists (select 1 from public.vip_user_roles r where r.user_id = auth.uid() and r.role = 'admin')
  );
$$;
revoke all on function public.iqzodiac_is_admin() from public;
revoke execute on function public.iqzodiac_is_admin() from anon;
grant execute on function public.iqzodiac_is_admin() to authenticated;

drop policy if exists profile_media_owner_read on public.profile_media;
create policy profile_media_owner_read on public.profile_media
  for select to authenticated
  using (
    user_id = auth.uid()
    or (is_public and exists (
      select 1 from public.profiles p
      where p.user_id = profile_media.user_id
        and coalesce((p.privacy->>'photosPublic')::boolean, false)
    ))
    or public.iqzodiac_is_admin()
  );

drop policy if exists profile_media_owner_insert on public.profile_media;
create policy profile_media_owner_insert on public.profile_media
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists profile_media_owner_update on public.profile_media;
create policy profile_media_owner_update on public.profile_media
  for update to authenticated
  using (user_id = auth.uid() or public.iqzodiac_is_admin())
  with check (user_id = auth.uid() or public.iqzodiac_is_admin());

drop policy if exists profile_media_owner_delete on public.profile_media;
create policy profile_media_owner_delete on public.profile_media
  for delete to authenticated
  using (user_id = auth.uid() or public.iqzodiac_is_admin());

create or replace function public.iqzodiac_is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_catalog
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.salon_owner_roles r where r.user_id = auth.uid() and r.role = 'owner')
    or exists (select 1 from public.vip_user_roles r where r.user_id = auth.uid() and r.role = 'admin')
  );
$$;
revoke all on function public.iqzodiac_is_admin() from public;
grant execute on function public.iqzodiac_is_admin() to authenticated;

-- Recreate policies that reference the admin function after it exists.
drop policy if exists profile_media_owner_read on public.profile_media;
create policy profile_media_owner_read on public.profile_media
  for select to authenticated
  using (
    user_id = auth.uid()
    or (is_public and exists (
      select 1 from public.profiles p
      where p.user_id = profile_media.user_id
        and coalesce((p.privacy->>'photosPublic')::boolean, false)
    ))
    or public.iqzodiac_is_admin()
  );

 drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read on public.profiles
  for select to authenticated using (public.iqzodiac_is_admin() or auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  pseudonym text := public.new_pseudonym();
begin
  insert into public.profiles (user_id, first_name, last_name, age, phone, country, city, preferred_language, display_name, handle)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    nullif(new.raw_user_meta_data->>'age', '')::smallint,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'country', ''),
    coalesce(new.raw_user_meta_data->>'city', ''),
    case when new.raw_user_meta_data->>'preferred_language' = 'ar' then 'ar' else 'en' end,
    pseudonym,
    '@' || lower(replace(pseudonym, '-', ''))
  ) on conflict (user_id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    age = excluded.age,
    phone = excluded.phone,
    country = excluded.country,
    city = excluded.city,
    preferred_language = excluded.preferred_language,
    updated_at = now();
  return new;
end;
$$;

-- Private bucket: all access goes through authenticated Storage policies below.
insert into storage.buckets (id, name, public)
values ('iqzodiac-media', 'iqzodiac-media', false)
on conflict (id) do update set public = false;

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
          and m.is_public
          and coalesce((p.privacy->>'photosPublic')::boolean, false)
      )
      or public.iqzodiac_is_admin()
    )
  );

drop policy if exists iqzodiac_media_owner_insert on storage.objects;
create policy iqzodiac_media_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'iqzodiac-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists iqzodiac_media_owner_update on storage.objects;
create policy iqzodiac_media_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'iqzodiac-media' and ((storage.foldername(name))[1] = auth.uid()::text or public.iqzodiac_is_admin()))
  with check (bucket_id = 'iqzodiac-media' and ((storage.foldername(name))[1] = auth.uid()::text or public.iqzodiac_is_admin()));

drop policy if exists iqzodiac_media_owner_delete on storage.objects;
create policy iqzodiac_media_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'iqzodiac-media' and ((storage.foldername(name))[1] = auth.uid()::text or public.iqzodiac_is_admin()));

create or replace function public.search_compatible_profiles(
  p_country text default null,
  p_city text default null,
  p_min_age smallint default null,
  p_max_age smallint default null,
  p_interest text default null
)
returns table (user_id uuid, display_name text, handle text, age smallint, country text, city text, compatibility_score integer, interests text[])
language sql stable security definer set search_path = public
as $$
with me as (
  select dp.personality_element, dp.zodiac_sign, dp.interests
  from public.discovery_profiles dp
  where dp.user_id = auth.uid() and dp.discovery_status = 'completed' and dp.discoverable = true
)
select ranked.user_id, ranked.display_name, ranked.handle, ranked.age, ranked.country, ranked.city, ranked.compatibility_score, ranked.interests
from (
  select dp.user_id, p.display_name, p.handle, p.age, p.country, p.city,
       greatest(0, least(100, (50
         + case when dp.personality_element = me.personality_element then 20 else 0 end
         + case when dp.zodiac_sign = me.zodiac_sign then 10 else 0 end
         + least(20, coalesce((select count(*) from unnest(dp.interests) candidate where candidate = any(me.interests)), 0) * 5)
       )))::integer as compatibility_score,
       dp.interests
from public.discovery_profiles dp
join public.profiles p on p.user_id = dp.user_id
cross join me
where dp.user_id <> auth.uid()
  and dp.discovery_status = 'completed'
  and dp.discoverable = true
  and (nullif(trim(p_country), '') is null or lower(p.country) = lower(trim(p_country)))
  and (nullif(trim(p_city), '') is null or p.city ilike '%' || trim(p_city) || '%')
  and (p_min_age is null or p.age >= p_min_age)
  and (p_max_age is null or p.age <= p_max_age)
  and (nullif(trim(p_interest), '') is null or exists (select 1 from unnest(dp.interests) i where i ilike '%' || trim(p_interest) || '%'))
  ) ranked
order by ranked.compatibility_score desc
limit 50;
$$;
revoke execute on function public.search_compatible_profiles(text, text, smallint, smallint, text) from public, anon;
grant execute on function public.search_compatible_profiles(text, text, smallint, smallint, text) to authenticated;
