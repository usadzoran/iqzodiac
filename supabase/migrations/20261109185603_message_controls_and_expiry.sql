-- Extend the existing private messaging model. Existing messages remain untouched:
-- expires_at is NULL for all existing rows, so only newly sent messages can expire.
create extension if not exists pg_cron;

alter table public.messages
  add column if not exists expires_at timestamptz,
  add column if not exists message_kind text not null default 'user';

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.messages'::regclass
      and conname = 'messages_message_kind_check'
  ) then
    alter table public.messages
      add constraint messages_message_kind_check
      check (message_kind in ('user', 'system')) not valid;
  end if;
end $$;
alter table public.messages validate constraint messages_message_kind_check;

create index if not exists messages_expiring_idx
  on public.messages (expires_at) where expires_at is not null;

create table if not exists public.conversation_message_settings (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  expiry_duration text not null default 'off'
    check (expiry_duration in ('off', '1h', '24h', '7d')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.conversation_message_settings enable row level security;
alter table public.conversation_message_settings force row level security;

create table if not exists public.message_user_hides (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (conversation_id, message_id, user_id)
);
create index if not exists message_user_hides_user_conversation_idx
  on public.message_user_hides (user_id, conversation_id);
alter table public.message_user_hides enable row level security;
alter table public.message_user_hides force row level security;

-- Use a narrowly-scoped SECURITY DEFINER helper to avoid recursive membership
-- policies on conversation_participants, whose legacy policy queried itself.
create or replace function public.is_conversation_participant(
  p_conversation_id uuid,
  p_user_id uuid default auth.uid()
) returns boolean
language sql stable security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select p_user_id = auth.uid() and exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id and cp.user_id = p_user_id
  );
$$;
revoke all on function public.is_conversation_participant(uuid, uuid) from public, anon;
grant execute on function public.is_conversation_participant(uuid, uuid) to authenticated;

-- Repair the existing recursive/broken membership policy and route policies
-- through the security-definer membership predicate.
drop policy if exists "Participants read membership" on public.conversation_participants;
create policy "Participants read membership" on public.conversation_participants
  for select to authenticated
  using (user_id = auth.uid() or public.is_conversation_participant(conversation_id, auth.uid()));
drop policy if exists "Participants read conversations" on public.conversations;
create policy "Participants read conversations" on public.conversations
  for select to authenticated using (public.is_conversation_participant(id, auth.uid()));
drop policy if exists "Participants read messages" on public.messages;
create policy "Participants read messages" on public.messages
  for select to authenticated using (public.is_conversation_participant(conversation_id, auth.uid()));
drop policy if exists "Participants send messages" on public.messages;
create policy "Participants send messages" on public.messages
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and message_kind = 'user'
    and public.is_conversation_participant(conversation_id, auth.uid())
  );

drop policy if exists conversation_message_settings_participant_read on public.conversation_message_settings;
create policy conversation_message_settings_participant_read on public.conversation_message_settings
  for select to authenticated using (public.is_conversation_participant(conversation_id, auth.uid()));
drop policy if exists message_user_hides_read_own on public.message_user_hides;
create policy message_user_hides_read_own on public.message_user_hides
  for select to authenticated using (user_id = auth.uid());
revoke all on public.conversation_message_settings, public.message_user_hides from anon, authenticated;
grant select on public.conversation_message_settings, public.message_user_hides to authenticated;

create or replace function public.iqzodiac_set_message_expiry(p_conversation_id uuid, p_duration text)
returns text
language plpgsql security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
  v_label text;
begin
  if v_uid is null or not public.is_conversation_participant(p_conversation_id, v_uid) then
    raise exception 'not_a_conversation_participant' using errcode = '42501';
  end if;
  if p_duration is null or p_duration not in ('off', '1h', '24h', '7d') then
    raise exception 'invalid_expiry_duration' using errcode = '22023';
  end if;
  insert into public.conversation_message_settings (conversation_id, expiry_duration, updated_by, updated_at)
  values (p_conversation_id, p_duration, v_uid, now())
  on conflict (conversation_id) do update
    set expiry_duration = excluded.expiry_duration,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;
  v_label := case p_duration
    when '1h' then '1h'
    when '24h' then '24h'
    when '7d' then '7d'
    else 'off'
  end;
  -- Durable in-conversation notice; the client localizes this event for display.
  insert into public.messages (conversation_id, sender_id, body, message_kind)
  values (p_conversation_id, v_uid, v_label, 'system');
  return p_duration;
end;
$$;
revoke all on function public.iqzodiac_set_message_expiry(uuid, text) from public, anon;
grant execute on function public.iqzodiac_set_message_expiry(uuid, text) to authenticated;

create or replace function public.iqzodiac_hide_messages_for_me(p_conversation_id uuid, p_message_ids uuid[])
returns integer
language plpgsql security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
  v_requested integer;
  v_valid integer;
  v_inserted integer;
begin
  if v_uid is null or not public.is_conversation_participant(p_conversation_id, v_uid) then
    raise exception 'not_a_conversation_participant' using errcode = '42501';
  end if;
  v_requested := (select count(distinct message_id) from unnest(coalesce(p_message_ids, '{}'::uuid[])) as selected(message_id));
  if v_requested < 1 or v_requested > 200 then
    raise exception 'invalid_message_selection' using errcode = '22023';
  end if;
  select count(distinct m.id) into v_valid
  from public.messages m
  where m.id = any(p_message_ids)
    and m.conversation_id = p_conversation_id
    and m.message_kind = 'user';
  if v_valid <> v_requested then
    raise exception 'message_selection_not_valid' using errcode = '22023';
  end if;
  insert into public.message_user_hides (conversation_id, message_id, user_id)
  select p_conversation_id, m.id, v_uid
  from public.messages m
  where m.id = any(p_message_ids)
    and m.conversation_id = p_conversation_id
    and m.message_kind = 'user'
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;
revoke all on function public.iqzodiac_hide_messages_for_me(uuid, uuid[]) from public, anon;
grant execute on function public.iqzodiac_hide_messages_for_me(uuid, uuid[]) to authenticated;

create or replace function public.iqzodiac_delete_messages_for_everyone(p_conversation_id uuid, p_message_ids uuid[])
returns integer
language plpgsql security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
  v_requested integer;
  v_valid integer;
  v_deleted integer;
begin
  if v_uid is null or not public.is_conversation_participant(p_conversation_id, v_uid) then
    raise exception 'not_a_conversation_participant' using errcode = '42501';
  end if;
  v_requested := (select count(distinct message_id) from unnest(coalesce(p_message_ids, '{}'::uuid[])) as selected(message_id));
  if v_requested < 1 or v_requested > 200 then
    raise exception 'invalid_message_selection' using errcode = '22023';
  end if;
  select count(distinct m.id) into v_valid
  from public.messages m
  where m.id = any(p_message_ids)
    and m.conversation_id = p_conversation_id
    and m.sender_id = v_uid
    and m.message_kind = 'user';
  if v_valid <> v_requested then
    raise exception 'only_own_messages_can_be_deleted_for_everyone' using errcode = '42501';
  end if;
  delete from public.messages m
  where m.id = any(p_message_ids)
    and m.conversation_id = p_conversation_id
    and m.sender_id = v_uid
    and m.message_kind = 'user';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
revoke all on function public.iqzodiac_delete_messages_for_everyone(uuid, uuid[]) from public, anon;
grant execute on function public.iqzodiac_delete_messages_for_everyone(uuid, uuid[]) to authenticated;

-- Keep the existing conversation list, but calculate its preview from messages
-- that remain visible in the current member's own history.
create or replace function public.list_my_conversations()
returns table(conversation_id uuid, other_user_id uuid, display_name text, handle text, last_message text, last_message_at timestamptz)
language sql security definer set search_path = public as $$
  select c.id, other.user_id, p.display_name, p.handle, lm.body, lm.created_at
  from public.conversations c
  join public.conversation_participants own on own.conversation_id = c.id and own.user_id = auth.uid()
  join public.conversation_participants other on other.conversation_id = c.id and other.user_id <> auth.uid()
  join public.profiles p on p.user_id = other.user_id
  left join lateral (
    select m.body, m.created_at
    from public.messages m
    where m.conversation_id = c.id
      and m.message_kind = 'user'
      and (m.expires_at is null or m.expires_at > now())
      and not exists (
        select 1 from public.message_user_hides h
        where h.conversation_id = c.id and h.message_id = m.id and h.user_id = auth.uid()
      )
    order by m.created_at desc
    limit 1
  ) lm on true
  order by coalesce(lm.created_at, c.created_at) desc;
$$;
revoke all on function public.list_my_conversations() from public, anon;
grant execute on function public.list_my_conversations() to authenticated;

create or replace function public.iqzodiac_apply_message_expiry()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare v_duration text;
begin
  if new.message_kind <> 'user' then
    new.expires_at := null;
    return new;
  end if;
  select s.expiry_duration into v_duration
  from public.conversation_message_settings s
  where s.conversation_id = new.conversation_id;
  new.expires_at := case v_duration
    when '1h' then now() + interval '1 hour'
    when '24h' then now() + interval '24 hours'
    when '7d' then now() + interval '7 days'
    else null
  end;
  return new;
end;
$$;
revoke all on function public.iqzodiac_apply_message_expiry() from public, anon, authenticated;
drop trigger if exists iqzodiac_apply_message_expiry on public.messages;
create trigger iqzodiac_apply_message_expiry
before insert on public.messages
for each row execute function public.iqzodiac_apply_message_expiry();

-- System setting notices should not create a private-message notification.
create or replace function public.iqzodiac_create_private_message_notification()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_recipient uuid; v_actor_name text;
begin
  if new.message_kind = 'system' then return new; end if;
  select cp.user_id into v_recipient from public.conversation_participants cp
   where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id order by cp.user_id limit 1;
  if v_recipient is null then return new; end if;
  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.handle), ''), 'Someone') into v_actor_name
    from public.profiles p where p.user_id = new.sender_id;
  insert into public.notifications (recipient_id, actor_id, notification_type, message)
  values (v_recipient, new.sender_id, 'private_message', coalesce(v_actor_name, 'Someone') || ' sent you a private message.');
  return new;
end;
$$;

alter table public.messages replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_user_hides') then
    alter publication supabase_realtime add table public.message_user_hides;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_message_settings') then
    alter publication supabase_realtime add table public.conversation_message_settings;
  end if;
end $$;

-- Expired messages are physically removed by PostgreSQL even when both users are offline.
-- The extension is database-side; clients never run the expiry sweep.
do $$ begin
  if not exists (select 1 from cron.job where jobname = 'iqzodiac_expire_private_messages') then
    perform cron.schedule(
      'iqzodiac_expire_private_messages',
      '* * * * *',
      'delete from public.messages where expires_at is not null and expires_at <= now();'
    );
  end if;
end $$;
