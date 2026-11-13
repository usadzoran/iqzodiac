-- Secure, additive foundation for My 3D Body.
-- Original photos and model assets live in a dedicated private bucket, never in profile_media.

create table if not exists public.profile_body_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'awaiting_engine'
    check (status in ('awaiting_engine','processing','ready','failed','cancelled')),
  visibility text not null default 'hide'
    check (visibility in ('show','hide')),
  face_anonymized boolean not null default false,
  originals_retention text not null default 'delete_after_processing'
    check (originals_retention in ('delete_after_processing','keep_until_deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visibility <> 'show' or (status = 'ready' and face_anonymized = true))
);

create index if not exists profile_body_models_owner_created_idx
  on public.profile_body_models (user_id, created_at desc);
create index if not exists profile_body_models_public_idx
  on public.profile_body_models (user_id, created_at desc)
  where status = 'ready' and visibility = 'show' and face_anonymized = true;
create unique index if not exists profile_body_models_one_visible_per_user_idx
  on public.profile_body_models (user_id)
  where visibility = 'show';
create unique index if not exists profile_body_models_one_pending_per_user_idx
  on public.profile_body_models (user_id)
  where status in ('awaiting_engine','processing');

alter table public.profile_body_models enable row level security;
alter table public.profile_body_models force row level security;
revoke all on table public.profile_body_models from public, anon, authenticated;
grant select (id, user_id, status, visibility, face_anonymized, created_at, updated_at)
  on table public.profile_body_models to anon, authenticated;
grant insert (id, user_id, originals_retention)
  on table public.profile_body_models to authenticated;
grant delete on table public.profile_body_models to service_role;
grant all on table public.profile_body_models to service_role;

drop policy if exists profile_body_models_owner_read on public.profile_body_models;
create policy profile_body_models_owner_read on public.profile_body_models
  for select to authenticated
  using (user_id = auth.uid());
drop policy if exists profile_body_models_public_read on public.profile_body_models;
create policy profile_body_models_public_read on public.profile_body_models
  for select to anon, authenticated
  using (status = 'ready' and visibility = 'show' and face_anonymized = true);
drop policy if exists profile_body_models_owner_insert on public.profile_body_models;
create policy profile_body_models_owner_insert on public.profile_body_models
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'awaiting_engine'
    and visibility = 'hide'
    and face_anonymized = false
  );
drop policy if exists profile_body_models_owner_delete on public.profile_body_models;

create table if not exists public.profile_body_scan_photos (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.profile_body_models(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  angle text not null check (angle in (
    'front','back','left','right',
    'front_left_45','front_right_45','back_left_45','back_right_45'
  )),
  storage_path text not null unique,
  mime_type text not null default 'image/jpeg' check (mime_type = 'image/jpeg'),
  size_bytes bigint not null check (size_bytes between 1 and 26214400),
  uploaded_at timestamptz not null default now(),
  unique (model_id, angle),
  check (storage_path = user_id::text || '/' || model_id::text || '/' || angle || '.jpg')
);
create index if not exists profile_body_scan_photos_owner_idx
  on public.profile_body_scan_photos (user_id, model_id);
alter table public.profile_body_scan_photos enable row level security;
alter table public.profile_body_scan_photos force row level security;
revoke all on table public.profile_body_scan_photos from public, anon, authenticated;
grant select, insert, delete on table public.profile_body_scan_photos to authenticated;
grant all on table public.profile_body_scan_photos to service_role;
drop policy if exists profile_body_scan_photos_owner_read on public.profile_body_scan_photos;
create policy profile_body_scan_photos_owner_read on public.profile_body_scan_photos
  for select to authenticated using (user_id = auth.uid());
drop policy if exists profile_body_scan_photos_owner_insert on public.profile_body_scan_photos;
create policy profile_body_scan_photos_owner_insert on public.profile_body_scan_photos
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profile_body_models m
      where m.id = profile_body_scan_photos.model_id
        and m.user_id = auth.uid()
        and m.status = 'awaiting_engine'
    )
  );
drop policy if exists profile_body_scan_photos_owner_delete on public.profile_body_scan_photos;
create policy profile_body_scan_photos_owner_delete on public.profile_body_scan_photos
  for delete to authenticated using (user_id = auth.uid());

-- Model paths are service-managed and intentionally unavailable to client roles.
create table if not exists public.profile_body_model_assets (
  model_id uuid primary key references public.profile_body_models(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null default 'model/gltf-binary' check (mime_type = 'model/gltf-binary'),
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  created_at timestamptz not null default now(),
  check (storage_path = user_id::text || '/' || model_id::text || '/model.glb')
);
alter table public.profile_body_model_assets enable row level security;
alter table public.profile_body_model_assets force row level security;
revoke all on table public.profile_body_model_assets from public, anon, authenticated;
grant all on table public.profile_body_model_assets to service_role;

create or replace function public.get_my_profile_body_models()
returns table (
  id uuid,
  status text,
  visibility text,
  face_anonymized boolean,
  originals_retention text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.status, m.visibility, m.face_anonymized,
         m.originals_retention, m.created_at, m.updated_at
  from public.profile_body_models m
  where m.user_id = auth.uid()
  order by m.created_at desc
  limit 1000;
$$;
revoke all on function public.get_my_profile_body_models() from public, anon;
grant execute on function public.get_my_profile_body_models() to authenticated;

create or replace function public.set_profile_body_visibility(p_model_id uuid, p_visibility text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_visibility not in ('show','hide') then raise exception 'invalid_visibility' using errcode = '22023'; end if;
  if p_visibility = 'show' then
    if not exists (
      select 1 from public.profile_body_models m
      where m.id = p_model_id and m.user_id = v_user_id
        and m.status = 'ready' and m.face_anonymized = true
    ) then
      raise exception 'an_anonymized_ready_model_is_required' using errcode = '23514';
    end if;
    update public.profile_body_models
      set visibility = 'hide', updated_at = now()
      where user_id = v_user_id and visibility = 'show' and id <> p_model_id;
  end if;
  update public.profile_body_models
    set visibility = p_visibility, updated_at = now()
    where id = p_model_id and user_id = v_user_id
      and (p_visibility = 'hide' or (status = 'ready' and face_anonymized = true));
  if not found then raise exception 'body_model_not_found_or_not_ready' using errcode = 'P0002'; end if;
  return true;
end;
$$;
revoke all on function public.set_profile_body_visibility(uuid, text) from public, anon;
grant execute on function public.set_profile_body_visibility(uuid, text) to authenticated;

create or replace function public.set_profile_body_retention(p_model_id uuid, p_retention text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_retention not in ('delete_after_processing','keep_until_deleted') then
    raise exception 'invalid_retention_policy' using errcode = '22023';
  end if;
  update public.profile_body_models
    set originals_retention = p_retention, updated_at = now()
    where id = p_model_id and user_id = v_user_id;
  if not found then raise exception 'body_model_not_found' using errcode = 'P0002'; end if;
  return true;
end;
$$;
revoke all on function public.set_profile_body_retention(uuid, text) from public, anon;
grant execute on function public.set_profile_body_retention(uuid, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'iqzodiac-body-private',
  'iqzodiac-body-private',
  false,
  52428800,
  array['image/jpeg','model/gltf-binary']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists iqzodiac_body3d_owner_read on storage.objects;
create policy iqzodiac_body3d_owner_read on storage.objects
  for select to authenticated
  using (bucket_id = 'iqzodiac-body-private' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists iqzodiac_body3d_source_insert on storage.objects;
create policy iqzodiac_body3d_source_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'iqzodiac-body-private'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
    and (storage.foldername(name))[3] is null
    and storage.filename(name) ~ '^(front|back|left|right|front_left_45|front_right_45|back_left_45|back_right_45)\.jpg$'
  );
drop policy if exists iqzodiac_body3d_owner_delete on storage.objects;
create policy iqzodiac_body3d_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'iqzodiac-body-private' and (storage.foldername(name))[1] = auth.uid()::text);


-- Only a trusted server-side processor may publish a result after all source views
-- and a verified face-anonymized GLB asset have been stored.
create or replace function public.guard_profile_body_model_ready()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.status = 'ready' then
    if new.face_anonymized is distinct from true
      or (select count(*) from public.profile_body_scan_photos p where p.model_id = new.id) <> 8
      or not exists (
        select 1 from public.profile_body_model_assets a
        where a.model_id = new.id and a.user_id = new.user_id
          and a.storage_path = new.user_id::text || '/' || new.id::text || '/model.glb'
          and a.mime_type = 'model/gltf-binary'
      ) then
      raise exception 'body_model_requires_eight_views_and_anonymized_glb' using errcode = '23514';
    end if;
  end if;
  if new.visibility = 'show' and (new.status <> 'ready' or new.face_anonymized is distinct from true) then
    raise exception 'body_model_must_be_ready_and_face_anonymized_to_be_public' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_profile_body_model_ready() from public, anon, authenticated;
drop trigger if exists profile_body_model_ready_guard on public.profile_body_models;
create trigger profile_body_model_ready_guard
  before insert or update of status, visibility, face_anonymized on public.profile_body_models
  for each row execute function public.guard_profile_body_model_ready();
