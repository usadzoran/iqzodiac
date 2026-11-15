-- Keep the live database contract aligned with the application.

-- Registration metadata must be copied into durable profile/discovery rows.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pseudonym text := public.new_pseudonym();
begin
  if exists (select 1 from public.iqzodiac_admin_email_allowlist a where lower(a.email) = lower(coalesce(new.email, ''))) then
    return new;
  end if;

  insert into public.profiles (
    user_id, first_name, last_name, age, phone, country, city,
    birth_country, birth_city, residence_country, residence_city,
    preferred_language, display_name, handle
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    nullif(new.raw_user_meta_data->>'age', '')::smallint,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'country', ''),
    coalesce(new.raw_user_meta_data->>'city', ''),
    coalesce(new.raw_user_meta_data->>'birth_country', ''),
    coalesce(new.raw_user_meta_data->>'birth_city', ''),
    coalesce(new.raw_user_meta_data->>'residence_country', coalesce(new.raw_user_meta_data->>'country', '')),
    coalesce(new.raw_user_meta_data->>'residence_city', coalesce(new.raw_user_meta_data->>'city', '')),
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
    birth_country = excluded.birth_country,
    birth_city = excluded.birth_city,
    residence_country = excluded.residence_country,
    residence_city = excluded.residence_city,
    preferred_language = excluded.preferred_language,
    updated_at = now();

  insert into public.discovery_profiles (user_id, birth_date, interests, discovery_status, discoverable)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'birth_date', '')::date,
    '{}'::text[],
    'not_started',
    false
  ) on conflict (user_id) do update set
    birth_date = coalesce(excluded.birth_date, public.discovery_profiles.birth_date),
    updated_at = now();

  return new;
end;
$$;

-- Membership changes must go through the RPCs, which validate room visibility and roles.
revoke insert, update on public.audio_room_members from authenticated;
alter function public.iqzodiac_create_audio_room(text, text, text, text, jsonb) security definer;
alter function public.iqzodiac_create_audio_room(text, text, text, text, jsonb) set row_security = off;
alter function public.iqzodiac_join_audio_room(uuid) security definer;
alter function public.iqzodiac_join_audio_room(uuid) set row_security = off;
alter function public.iqzodiac_leave_audio_room(uuid) security definer;
alter function public.iqzodiac_leave_audio_room(uuid) set row_security = off;

-- Preserve message deep-links when the later expiry migration replaces the trigger.
create or replace function public.iqzodiac_create_private_message_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_recipient uuid;
  v_actor_name text;
begin
  if new.message_kind = 'system' then return new; end if;
  select cp.user_id into v_recipient
  from public.conversation_participants cp
  where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id
  order by cp.user_id limit 1;
  if v_recipient is null then return new; end if;
  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.handle), ''), 'Someone')
    into v_actor_name
  from public.profiles p where p.user_id = new.sender_id;
  insert into public.notifications (recipient_id, actor_id, notification_type, message_id, message)
  values (v_recipient, new.sender_id, 'private_message', new.id, coalesce(v_actor_name, 'Someone') || ' sent you a private message.');
  return new;
end;
$$;

-- Durable Reel views and exact feed metrics.
create table if not exists public.reel_views (
  reel_id uuid not null references public.reels(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  primary key (reel_id, viewer_id)
);
alter table public.reel_views enable row level security;
alter table public.reel_views force row level security;
revoke all on public.reel_views from anon, authenticated;
grant select on public.reel_views to authenticated;
drop policy if exists reel_views_owner_read on public.reel_views;
create policy reel_views_owner_read on public.reel_views
for select to authenticated using (viewer_id = auth.uid() or exists (select 1 from public.reels r where r.id = reel_views.reel_id and r.author_id = auth.uid()));

create or replace function public.record_reel_view(p_reel_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then return false; end if;
  insert into public.reel_views (reel_id, viewer_id, first_viewed_at, last_viewed_at)
  select r.id, auth.uid(), now(), now()
  from public.reels r
  where r.id = p_reel_id and r.author_id <> auth.uid()
  on conflict (reel_id, viewer_id) do update set last_viewed_at = excluded.last_viewed_at;
  return found;
end;
$$;
revoke all on function public.record_reel_view(uuid) from public, anon;
grant execute on function public.record_reel_view(uuid) to authenticated;

create or replace function public.get_reel_feed_metrics(p_reel_ids uuid[])
returns table(reel_id uuid, like_count bigint, comment_count bigint, liked_by_viewer boolean)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
with requested as (
  select distinct requested_ids.id
  from unnest(coalesce(p_reel_ids, array[]::uuid[])) as requested_ids(id)
  where requested_ids.id is not null
  order by requested_ids.id
  limit 50
)
select r.id,
  (select count(*) from public.reel_likes rl where rl.reel_id = r.id)::bigint,
  (select count(*) from public.reel_comments rc where rc.reel_id = r.id)::bigint,
  exists (select 1 from public.reel_likes rl where rl.reel_id = r.id and rl.user_id = auth.uid())
from requested q join public.reels r on r.id = q.id
where auth.uid() is not null;
$$;
revoke all on function public.get_reel_feed_metrics(uuid[]) from public, anon;
grant execute on function public.get_reel_feed_metrics(uuid[]) to authenticated;

-- Enable live updates for the user-facing social/live surfaces.
drop policy if exists vip_live_sessions_read_vip on public.vip_live_sessions;
create policy vip_live_sessions_read_vip on public.vip_live_sessions
for select to authenticated
using ((visibility = 'public' and status in ('scheduled', 'live')) or host_user_id = auth.uid());

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    for table_name in select unnest(array['audio_rooms','audio_room_members','reels','reel_comments','reel_likes']) loop
      begin
        if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
          execute format('alter publication supabase_realtime add table public.%I', table_name);
        end if;
      exception when undefined_table then null;
      end;
    end loop;
  end if;
end $$;
