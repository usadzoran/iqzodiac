-- Existing private threads remain available for history, but their context
-- explicitly marks a soft-removed listing as no longer active.
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
    case when l.deleted_at is not null then 'removed' else l.status end,
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
