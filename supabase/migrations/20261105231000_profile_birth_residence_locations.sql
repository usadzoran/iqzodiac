alter table public.profiles
  add column if not exists birth_country text not null default '',
  add column if not exists birth_city text not null default '',
  add column if not exists residence_country text not null default '',
  add column if not exists residence_city text not null default '';

update public.profiles
set residence_country = coalesce(nullif(trim(country), ''), ''),
    residence_city = coalesce(nullif(trim(city), ''), '')
where residence_country = '' or residence_city = '';

create index if not exists profiles_residence_location_idx
  on public.profiles (lower(residence_country), lower(residence_city));
