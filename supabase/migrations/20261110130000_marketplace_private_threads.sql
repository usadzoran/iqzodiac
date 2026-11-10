-- Keep marketplace inquiries inside the existing private messaging system,
-- while binding each listing inquiry to its buyer, seller, and conversation.
create table if not exists public.marketplace_threads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_threads_distinct_parties check (buyer_id <> seller_id),
  constraint marketplace_threads_listing_buyer_unique unique (listing_id, buyer_id)
);

create index if not exists marketplace_threads_conversation_updated_idx
  on public.marketplace_threads (conversation_id, updated_at desc);
create index if not exists marketplace_threads_seller_updated_idx
  on public.marketplace_threads (seller_id, updated_at desc);

alter table public.marketplace_threads enable row level security;
alter table public.marketplace_threads force row level security;
revoke all on public.marketplace_threads from public, anon, authenticated;
grant select on public.marketplace_threads to authenticated;
drop policy if exists marketplace_threads_parties_read on public.marketplace_threads;
create policy marketplace_threads_parties_read on public.marketplace_threads
  for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());

-- The client supplies only the listing ID. The authenticated buyer and seller
-- are derived from the session and the listing, never trusted from client input.
create or replace function public.marketplace_start_thread(p_listing_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_buyer uuid := auth.uid();
  v_seller uuid;
  v_conversation uuid;
begin
  if v_buyer is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select l.seller_id into v_seller
  from public.marketplace_listings l
  where l.id = p_listing_id and l.status = 'active';
  if not found then
    raise exception 'listing_not_found_or_inactive' using errcode = 'P0002';
  end if;
  if v_seller = v_buyer then
    raise exception 'seller_cannot_message_self' using errcode = '42501';
  end if;

  -- A subtransaction rolls back a just-created conversation if a concurrent
  -- request wins the unique (listing, buyer) thread constraint.
  begin
    select t.conversation_id into v_conversation
    from public.marketplace_threads t
    where t.listing_id = p_listing_id and t.buyer_id = v_buyer
    for update;
    if found then
      update public.marketplace_threads
      set updated_at = now()
      where listing_id = p_listing_id and buyer_id = v_buyer
      returning conversation_id into v_conversation;
      return v_conversation;
    end if;

    -- Reuse the existing direct conversation for this buyer/seller pair when
    -- present, so marketplace inquiries do not create duplicate inbox entries.
    select c.id into v_conversation
    from public.conversations c
    join public.conversation_participants buyer_participant
      on buyer_participant.conversation_id = c.id and buyer_participant.user_id = v_buyer
    join public.conversation_participants seller_participant
      on seller_participant.conversation_id = c.id and seller_participant.user_id = v_seller
    where (select count(*) from public.conversation_participants cp where cp.conversation_id = c.id) = 2
    order by c.updated_at desc, c.created_at desc
    limit 1;

    if v_conversation is null then
      insert into public.conversations default values returning id into v_conversation;
      insert into public.conversation_participants (conversation_id, user_id)
      values (v_conversation, v_buyer), (v_conversation, v_seller);
    end if;

    insert into public.marketplace_threads (listing_id, buyer_id, seller_id, conversation_id)
    values (p_listing_id, v_buyer, v_seller, v_conversation);
    return v_conversation;
  exception when unique_violation then
    select t.conversation_id into v_conversation
    from public.marketplace_threads t
    where t.listing_id = p_listing_id and t.buyer_id = v_buyer;
    if found then
      update public.marketplace_threads
      set updated_at = now()
      where listing_id = p_listing_id and buyer_id = v_buyer
      returning conversation_id into v_conversation;
      return v_conversation;
    end if;
    raise;
  end;
end;
$$;
revoke all on function public.marketplace_start_thread(uuid) from public, anon, authenticated;
grant execute on function public.marketplace_start_thread(uuid) to authenticated;

-- Return only the listing context and counterpart identity to an actual member
-- of the attached conversation. This lets both sides see what the chat is about.
create or replace function public.marketplace_get_thread_context(
  p_conversation_id uuid,
  p_listing_id uuid default null
)
returns table (
  conversation_id uuid,
  listing_id uuid,
  listing_title text,
  listing_kind text,
  price numeric,
  currency_code text,
  listing_status text,
  buyer_id uuid,
  seller_id uuid,
  other_user_id uuid,
  other_display_name text,
  other_handle text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select
    t.conversation_id,
    t.listing_id,
    l.title,
    l.kind,
    l.price,
    l.currency_code,
    l.status,
    t.buyer_id,
    t.seller_id,
    case when auth.uid() = t.buyer_id then t.seller_id else t.buyer_id end,
    coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.handle), ''), 'IQZodiac member'),
    p.handle,
    t.updated_at
  from public.marketplace_threads t
  join public.marketplace_listings l on l.id = t.listing_id
  left join public.profiles p
    on p.user_id = case when auth.uid() = t.buyer_id then t.seller_id else t.buyer_id end
  where t.conversation_id = p_conversation_id
    and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    and (p_listing_id is null or t.listing_id = p_listing_id)
    and public.is_conversation_participant(p_conversation_id, auth.uid())
  order by t.updated_at desc, t.created_at desc
  limit 1;
$$;
revoke all on function public.marketplace_get_thread_context(uuid, uuid) from public, anon, authenticated;
grant execute on function public.marketplace_get_thread_context(uuid, uuid) to authenticated;

-- The secure publish RPC rejects anonymous sessions itself; remove the
-- unnecessary anonymous EXECUTE grant as defense in depth.
revoke all on function public.marketplace_publish_listing(text, text, text, uuid, numeric, text, text, text, text, text, text[])
  from public, anon;
grant execute on function public.marketplace_publish_listing(text, text, text, uuid, numeric, text, text, text, text, text, text[])
  to authenticated;
