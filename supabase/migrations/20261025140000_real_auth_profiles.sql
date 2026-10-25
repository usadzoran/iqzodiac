-- Real account foundation for IQZodiac.
-- Apply with Supabase migrations before enabling production signup.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  age smallint check (age is null or (age >= 18 and age <= 120)),
  phone text not null default '',
  display_name text not null,
  handle text not null unique,
  privacy jsonb not null default jsonb_build_object(
    'publicIdentity', 'pseudonym',
    'realNameVisibility', 'private',
    'personalInfoVisibility', 'private',
    'ageVisibility', false,
    'phoneVisibility', false,
    'photosPublic', false,
    'revealRequiresMutualConsent', true
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy "Members read own profile" on public.profiles for select to authenticated using (auth.uid() = user_id);
create policy "Members update own profile" on public.profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.new_pseudonym()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := (array['Nova','Luna','Orion','Astra','Echo','Comet','Sage','River','Sol','Lyra'])[1 + floor(random() * 10)::int]
      || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    exit when not exists (select 1 from public.profiles where display_name = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  pseudonym text := public.new_pseudonym();
begin
  insert into public.profiles (user_id, first_name, last_name, age, phone, display_name, handle)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    nullif(new.raw_user_meta_data->>'age', '')::smallint,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    pseudonym,
    '@' || lower(replace(pseudonym, '-', ''))
  ) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
