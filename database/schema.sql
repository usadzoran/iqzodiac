-- IQZodiac discovery foundation (Supabase/PostgreSQL)
-- PREPARATION ONLY: this migration is not applied by the static prototype.
-- Requires Supabase Auth and an authenticated database client before use.

create extension if not exists pgcrypto;

create table if not exists public.discovery_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birth_date date,
  zodiac_sign text check (zodiac_sign is null or zodiac_sign in (
    'Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio',
    'Sagittarius','Capricorn','Aquarius','Pisces'
  )),
  personality_element text check (personality_element is null or personality_element in ('fire','earth','water','air')),
  personality_summary text,
  interests text[] not null default '{}',
  discoverable boolean not null default false,
  discovery_status text not null default 'not_started'
    check (discovery_status in ('not_started','in_progress','completed')),
  questionnaire_version text,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint completed_requires_timestamp check (discovery_status <> 'completed' or completed_at is not null)
);

create table if not exists public.discovery_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  questionnaire_version text not null,
  question_id text not null,
  answer_choice text,
  answer_text text,
  answered_at timestamptz not null default now(),
  constraint discovery_answer_has_value check (answer_choice is not null or nullif(trim(answer_text), '') is not null),
  unique (user_id, questionnaire_version, question_id)
);

create index if not exists discovery_profiles_completed_idx
  on public.discovery_profiles (discovery_status, updated_at desc);
create index if not exists discovery_profiles_zodiac_idx
  on public.discovery_profiles (zodiac_sign) where discovery_status = 'completed';
create index if not exists discovery_answers_user_idx
  on public.discovery_answers (user_id, questionnaire_version, answered_at);

alter table public.discovery_profiles enable row level security;
alter table public.discovery_answers enable row level security;

-- Members may read/write only their own discovery data.
drop policy if exists "Members read own discovery profile" on public.discovery_profiles;
create policy "Members read own discovery profile" on public.discovery_profiles
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Members insert own discovery profile" on public.discovery_profiles;
create policy "Members insert own discovery profile" on public.discovery_profiles
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Members update own discovery profile" on public.discovery_profiles;
create policy "Members update own discovery profile" on public.discovery_profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Members read own discovery answers" on public.discovery_answers;
create policy "Members read own discovery answers" on public.discovery_answers
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Members insert own discovery answers" on public.discovery_answers;
create policy "Members insert own discovery answers" on public.discovery_answers
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Members update own discovery answers" on public.discovery_answers;
create policy "Members update own discovery answers" on public.discovery_answers
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- No public profiles/read policy is created here. Matching must use a server-side,
-- authenticated, privacy-filtered query and must exclude auth.uid() from its results.
-- Never put a service-role key in browser code.
