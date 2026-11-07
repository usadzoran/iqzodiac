-- Persistent audio-room directory with user-selected categories.
create table if not exists public.audio_rooms (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 500),
  category text not null default 'General' check (char_length(trim(category)) between 2 and 80),
  status text not null default 'open' check (status in ('open', 'closed')), 
  listener_count integer not null default 0 check (listener_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists audio_rooms_category_status_idx on public.audio_rooms(category, status, created_at desc);
create index if not exists audio_rooms_host_idx on public.audio_rooms(host_user_id, created_at desc);
alter table public.audio_rooms enable row level security;
alter table public.audio_rooms force row level security;
revoke all on public.audio_rooms from anon, authenticated;
grant select, insert, update on public.audio_rooms to authenticated;
drop policy if exists audio_rooms_read_open on public.audio_rooms;
create policy audio_rooms_read_open on public.audio_rooms for select to authenticated using (status = 'open' or host_user_id = auth.uid());
drop policy if exists audio_rooms_create_own on public.audio_rooms;
create policy audio_rooms_create_own on public.audio_rooms for insert to authenticated with check (host_user_id = auth.uid());
drop policy if exists audio_rooms_update_own on public.audio_rooms;
create policy audio_rooms_update_own on public.audio_rooms for update to authenticated using (host_user_id = auth.uid()) with check (host_user_id = auth.uid());
create or replace function public.iqzodiac_create_audio_room(p_title text, p_description text, p_category text)
returns uuid language plpgsql security invoker set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  insert into public.audio_rooms(host_user_id, title, description, category)
  values (auth.uid(), trim(p_title), left(coalesce(p_description, ''), 500), left(trim(coalesce(p_category, 'General')), 80))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.iqzodiac_create_audio_room(text, text, text) from public, anon;
grant execute on function public.iqzodiac_create_audio_room(text, text, text) to authenticated;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'audio_rooms') then
    alter publication supabase_realtime add table public.audio_rooms;
  end if;
exception when undefined_object then null;
end $$;
