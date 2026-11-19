-- Durable realtime state for live broadcast viewers, likes, bans and per-session moderators.
create table if not exists public.vip_live_viewers (
  live_session_id uuid not null references public.vip_live_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (live_session_id, user_id)
);

create table if not exists public.vip_live_likes (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.vip_live_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.vip_live_moderators (
  live_session_id uuid not null references public.vip_live_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid not null references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  primary key (live_session_id, user_id)
);

create table if not exists public.vip_live_bans (
  live_session_id uuid not null references public.vip_live_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  banned_by uuid not null references auth.users(id) on delete restrict,
  banned_at timestamptz not null default now(),
  primary key (live_session_id, user_id)
);

create index if not exists vip_live_viewers_seen_idx on public.vip_live_viewers(live_session_id, last_seen_at desc);
create index if not exists vip_live_likes_session_created_idx on public.vip_live_likes(live_session_id, created_at desc);

alter table public.vip_moderation_actions drop constraint if exists vip_moderation_actions_action_code_check;
alter table public.vip_moderation_actions add constraint vip_moderation_actions_action_code_check check (action_code in ('hide_message', 'remove_message', 'mute_user', 'ban_user', 'unban_user', 'end_session', 'suspend_session', 'resolve_report', 'appoint_moderator', 'remove_moderator'));

alter table public.vip_live_viewers enable row level security;
alter table public.vip_live_likes enable row level security;
alter table public.vip_live_moderators enable row level security;
alter table public.vip_live_bans enable row level security;

revoke all on public.vip_live_viewers, public.vip_live_likes, public.vip_live_moderators, public.vip_live_bans from anon, authenticated;
grant select on public.vip_live_viewers, public.vip_live_likes to authenticated;
create policy vip_live_viewers_read_active on public.vip_live_viewers for select to authenticated using (exists (select 1 from public.vip_live_sessions s where s.id = live_session_id and ((s.visibility = 'public' and s.status in ('scheduled','live')) or s.host_user_id = auth.uid())));
create policy vip_live_likes_read_active on public.vip_live_likes for select to authenticated using (exists (select 1 from public.vip_live_sessions s where s.id = live_session_id and ((s.visibility = 'public' and s.status in ('scheduled','live')) or s.host_user_id = auth.uid())));

drop policy if exists vip_live_chat_insert_authenticated on public.vip_live_chat_messages;
create policy vip_live_chat_insert_authenticated on public.vip_live_chat_messages
for insert to authenticated
with check (
  sender_user_id = auth.uid()
  and not exists (select 1 from public.vip_live_bans b where b.live_session_id = vip_live_chat_messages.live_session_id and b.user_id = auth.uid())
  and exists (
    select 1 from public.vip_live_sessions s
    where s.id = live_session_id
      and ((s.visibility = 'public' and s.status in ('scheduled', 'live')) or s.host_user_id = auth.uid())
  )
);

create or replace function public.iqzodiac_live_heartbeat(p_live_session_id uuid, p_present boolean default true)
returns integer language plpgsql security definer set search_path = public, pg_catalog
as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not exists (select 1 from public.vip_live_sessions where id = p_live_session_id and status in ('scheduled','live')) then raise exception 'live_session_not_active'; end if;
  if exists (select 1 from public.vip_live_bans where live_session_id = p_live_session_id and user_id = auth.uid()) then raise exception 'live_user_banned'; end if;
  if p_present then
    insert into public.vip_live_viewers(live_session_id, user_id, last_seen_at)
    values (p_live_session_id, auth.uid(), now())
    on conflict (live_session_id, user_id) do update set last_seen_at = excluded.last_seen_at;
  else
    delete from public.vip_live_viewers where live_session_id = p_live_session_id and user_id = auth.uid();
  end if;
  delete from public.vip_live_viewers where live_session_id = p_live_session_id and last_seen_at < now() - interval '45 seconds';
  select count(*)::integer into v_count
  from public.vip_live_viewers v
  join public.vip_live_sessions s on s.id = v.live_session_id
  where v.live_session_id = p_live_session_id and v.last_seen_at >= now() - interval '45 seconds' and v.user_id <> s.host_user_id;
  update public.vip_live_sessions set viewer_count = v_count, updated_at = now() where id = p_live_session_id;
  return v_count;
end;
$$;

create or replace function public.iqzodiac_live_like(p_live_session_id uuid)
returns integer language plpgsql security definer set search_path = public, pg_catalog
as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not exists (select 1 from public.vip_live_sessions where id = p_live_session_id and status = 'live') then raise exception 'live_session_not_active'; end if;
  if exists (select 1 from public.vip_live_bans where live_session_id = p_live_session_id and user_id = auth.uid()) then raise exception 'live_user_banned'; end if;
  if exists (select 1 from public.vip_live_likes where live_session_id = p_live_session_id and user_id = auth.uid() and created_at > now() - interval '700 milliseconds') then raise exception 'live_like_rate_limited'; end if;
  insert into public.vip_live_likes(live_session_id, user_id) values (p_live_session_id, auth.uid());
  select count(*)::integer into v_count from public.vip_live_likes where live_session_id = p_live_session_id;
  return v_count;
end;
$$;

create or replace function public.iqzodiac_live_moderate(p_live_session_id uuid, p_target_user_id uuid, p_action text)
returns boolean language plpgsql security definer set search_path = public, pg_catalog
as $$
declare v_host uuid; v_is_moderator boolean; v_message_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select host_user_id into v_host from public.vip_live_sessions where id = p_live_session_id;
  if v_host is null then raise exception 'live_session_not_found'; end if;
  v_is_moderator := exists (select 1 from public.vip_live_moderators where live_session_id = p_live_session_id and user_id = auth.uid());
  if auth.uid() <> v_host and not v_is_moderator then raise exception 'moderator_required'; end if;
  if p_target_user_id = v_host then raise exception 'cannot_moderate_host'; end if;
  if p_action = 'appoint_moderator' and auth.uid() = v_host then
    insert into public.vip_live_moderators(live_session_id, user_id, granted_by) values (p_live_session_id, p_target_user_id, auth.uid()) on conflict (live_session_id, user_id) do nothing;
  elsif p_action = 'remove_moderator' and auth.uid() = v_host then
    delete from public.vip_live_moderators where live_session_id = p_live_session_id and user_id = p_target_user_id;
  elsif p_action = 'ban_user' then
    insert into public.vip_live_bans(live_session_id, user_id, banned_by) values (p_live_session_id, p_target_user_id, auth.uid()) on conflict (live_session_id, user_id) do nothing;
    delete from public.vip_live_viewers where live_session_id = p_live_session_id and user_id = p_target_user_id;
  elsif p_action = 'unban_user' and auth.uid() = v_host then
    delete from public.vip_live_bans where live_session_id = p_live_session_id and user_id = p_target_user_id;
  elsif p_action in ('hide_message','remove_message') then
    select id into v_message_id from public.vip_live_chat_messages where id = p_target_user_id;
    if v_message_id is null then raise exception 'live_message_not_found'; end if;
    update public.vip_live_chat_messages set moderation_status = case when p_action = 'hide_message' then 'hidden' else 'removed' end, moderated_by = auth.uid(), moderated_at = now() where id = v_message_id and live_session_id = p_live_session_id;
  else
    raise exception 'unsupported_live_moderation_action';
  end if;
  insert into public.vip_moderation_actions(live_session_id, actor_user_id, target_user_id, action_code) values (p_live_session_id, auth.uid(), p_target_user_id, p_action);
  return true;
end;
$$;

revoke all on function public.iqzodiac_live_heartbeat(uuid, boolean), public.iqzodiac_live_like(uuid), public.iqzodiac_live_moderate(uuid, uuid, text) from public, anon;
grant execute on function public.iqzodiac_live_heartbeat(uuid, boolean), public.iqzodiac_live_like(uuid), public.iqzodiac_live_moderate(uuid, uuid, text) to authenticated;

do $$
declare table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    for table_name in select unnest(array['vip_live_viewers','vip_live_likes','vip_live_moderators','vip_live_bans']) loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;
