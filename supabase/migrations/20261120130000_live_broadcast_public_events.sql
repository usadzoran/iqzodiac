-- Safe, additive helpers for public live UI events.
-- No existing tables or columns are replaced, and financial writes remain in the existing atomic RPC.

create or replace function public.iqzodiac_live_participant_labels(
  p_live_session_id uuid,
  p_user_ids uuid[]
)
returns table(user_id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_host_user_id uuid;
  v_is_public boolean;
  v_status text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if coalesce(cardinality(p_user_ids), 0) > 50 then raise exception 'too_many_participants' using errcode = '22023'; end if;

  select s.host_user_id, s.visibility = 'public', s.status
    into v_host_user_id, v_is_public, v_status
  from public.vip_live_sessions s
  where s.id = p_live_session_id;
  if v_host_user_id is null then raise exception 'live_session_not_found' using errcode = 'P0002'; end if;
  if v_status not in ('scheduled', 'live') or (not v_is_public and v_host_user_id <> auth.uid()) then
    raise exception 'live_session_access_denied' using errcode = '42501';
  end if;

  return query
  select p.user_id,
    case
      when coalesce(p.privacy ->> 'publicIdentity', 'pseudonym') = 'pseudonym'
        then coalesce(nullif(trim(p.display_name), ''), 'مستخدم')
      else 'مستخدم-' || upper(substr(replace(p.user_id::text, '-', ''), 1, 4))
    end
  from public.profiles p
  where p.user_id = any(coalesce(p_user_ids, '{}'::uuid[]))
    and (
      p.user_id = v_host_user_id
      or exists (select 1 from public.vip_live_viewers v where v.live_session_id = p_live_session_id and v.user_id = p.user_id)
      or exists (select 1 from public.vip_live_chat_messages c where c.live_session_id = p_live_session_id and c.sender_user_id = p.user_id)
      or exists (select 1 from public.vip_gift_transactions g where g.live_session_id = p_live_session_id and g.sender_user_id = p.user_id and g.status = 'settled')
    );
end;
$$;

revoke all on function public.iqzodiac_live_participant_labels(uuid, uuid[]) from public, anon;
grant execute on function public.iqzodiac_live_participant_labels(uuid, uuid[]) to authenticated;

create or replace function public.iqzodiac_live_gift_event(
  p_live_session_id uuid,
  p_transaction_id uuid
)
returns table(
  id uuid,
  sender_label text,
  gift_id uuid,
  gift_name text,
  icon_asset_ref text,
  quantity integer,
  total_price_coins bigint,
  status text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_is_public boolean;
  v_status text;
  v_host_user_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select s.visibility = 'public', s.status, s.host_user_id
    into v_is_public, v_status, v_host_user_id
  from public.vip_live_sessions s
  where s.id = p_live_session_id;
  if v_host_user_id is null then raise exception 'live_session_not_found' using errcode = 'P0002'; end if;
  if v_status <> 'live' or (not v_is_public and v_host_user_id <> auth.uid()) then
    raise exception 'live_session_access_denied' using errcode = '42501';
  end if;

  return query
  select t.id,
    case
      when coalesce(p.privacy ->> 'publicIdentity', 'pseudonym') = 'pseudonym'
        then coalesce(nullif(trim(p.display_name), ''), 'مستخدم')
      else 'مستخدم-' || upper(substr(replace(t.sender_user_id::text, '-', ''), 1, 4))
    end,
    t.gift_id, t.gift_name_snapshot, g.icon_asset_ref,
    t.quantity, coalesce(t.total_price_coins, t.price_coins_snapshot * t.quantity), t.status
  from public.vip_gift_transactions t
  left join public.profiles p on p.user_id = t.sender_user_id
  left join public.vip_gifts g on g.id = t.gift_id
  where t.id = p_transaction_id
    and t.live_session_id = p_live_session_id
    and t.status = 'settled';
end;
$$;

revoke all on function public.iqzodiac_live_gift_event(uuid, uuid) from public, anon;
grant execute on function public.iqzodiac_live_gift_event(uuid, uuid) to authenticated;

-- The active catalog is non-sensitive and is needed by ordinary authenticated viewers.
drop policy if exists vip_gifts_read_active_authenticated on public.vip_gifts;
create policy vip_gifts_read_active_authenticated on public.vip_gifts
for select to authenticated using (is_active);

-- Enforce the saved room_settings.allow_chat choice at the database policy boundary as well as in the UI.
drop policy if exists vip_live_chat_insert_authenticated on public.vip_live_chat_messages;
create policy vip_live_chat_insert_authenticated on public.vip_live_chat_messages
for insert to authenticated
with check (
  sender_user_id = auth.uid()
  and not exists (
    select 1 from public.vip_live_bans b
    where b.live_session_id = vip_live_chat_messages.live_session_id and b.user_id = auth.uid()
  )
  and exists (
    select 1 from public.vip_live_sessions s
    where s.id = public.vip_live_chat_messages.live_session_id
      and s.status = 'live'
      and (s.visibility = 'public' or s.host_user_id = auth.uid())
      and coalesce((s.room_settings ->> 'allow_chat')::boolean, true)
  )
);
