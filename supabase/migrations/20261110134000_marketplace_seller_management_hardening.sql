-- Lock the listing kind in the update RPC and verify ownership before checking
-- related transactions, avoiding cross-owner information leakage.
create or replace function public.marketplace_update_listing(
  p_listing_id uuid,
  p_kind text,
  p_title text,
  p_description text,
  p_category_id uuid,
  p_price numeric,
  p_currency_code text,
  p_pricing_type text,
  p_condition text,
  p_country text,
  p_city text,
  p_delivery_options text[]
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
  v_category_kind text;
  v_updated_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_kind not in ('product', 'service') then
    raise exception 'invalid_listing_kind' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_title, ''))) < 3 or char_length(trim(p_title)) > 140 then
    raise exception 'invalid_listing_title' using errcode = '22023';
  end if;
  if p_description is null or char_length(p_description) > 10000 then
    raise exception 'invalid_listing_description' using errcode = '22023';
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'invalid_listing_price' using errcode = '22023';
  end if;
  if p_currency_code is null or p_currency_code !~ '^[A-Z]{3}$' then
    raise exception 'invalid_currency_code' using errcode = '22023';
  end if;
  if p_pricing_type is null or p_pricing_type not in ('fixed', 'hourly', 'starting_from', 'contact') then
    raise exception 'invalid_pricing_type' using errcode = '22023';
  end if;
  if p_kind = 'product' and coalesce(p_condition, '') not in ('new', 'like_new', 'used') then
    raise exception 'invalid_product_condition' using errcode = '22023';
  end if;
  if p_kind = 'service' and p_condition is not null then
    raise exception 'service_condition_not_allowed' using errcode = '22023';
  end if;
  if p_category_id is null then
    raise exception 'category_required' using errcode = '22023';
  end if;
  select c.kind into v_category_kind
  from public.marketplace_categories c
  where c.id = p_category_id and c.is_active;
  if v_category_kind is null or v_category_kind <> p_kind then
    raise exception 'invalid_category' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_delivery_options), 0) < 1
     or not (p_delivery_options <@ array['shipping', 'local_pickup', 'digital_delivery']::text[]) then
    raise exception 'invalid_delivery_options' using errcode = '22023';
  end if;
  if char_length(coalesce(p_country, '')) > 120 or char_length(coalesce(p_city, '')) > 120 then
    raise exception 'invalid_listing_location' using errcode = '22023';
  end if;

  update public.marketplace_listings l
  set title = trim(p_title),
      description = trim(p_description),
      category_id = p_category_id,
      price = p_price,
      currency_code = p_currency_code,
      pricing_type = p_pricing_type,
      condition = nullif(p_condition, ''),
      country = coalesce(trim(p_country), ''),
      city = coalesce(trim(p_city), ''),
      delivery_options = p_delivery_options,
      updated_at = now()
  where l.id = p_listing_id and l.seller_id = v_uid and l.kind = p_kind and l.deleted_at is null
  returning l.id into v_updated_id;
  if v_updated_id is null then
    raise exception 'listing_not_owned_or_kind_immutable' using errcode = '42501';
  end if;
  return v_updated_id;
end;
$$;
revoke all on function public.marketplace_update_listing(uuid, text, text, text, uuid, numeric, text, text, text, text, text, text[])
  from public, anon, authenticated;
grant execute on function public.marketplace_update_listing(uuid, text, text, text, uuid, numeric, text, text, text, text, text, text[])
  to authenticated;

create or replace function public.marketplace_delete_listing(p_listing_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
  v_deleted_at timestamptz := now();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  perform 1 from public.marketplace_listings l
  where l.id = p_listing_id and l.seller_id = v_uid and l.deleted_at is null
  for update;
  if not found then
    raise exception 'listing_not_owned_or_removed' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.marketplace_orders o
    where o.listing_id = p_listing_id and o.status in ('pending', 'confirmed', 'processing', 'shipped')
  ) or exists (
    select 1 from public.marketplace_service_requests r
    where r.listing_id = p_listing_id and r.status in ('pending', 'accepted', 'scheduled')
  ) then
    raise exception 'listing_has_open_transactions' using errcode = '23503';
  end if;

  update public.marketplace_listings l
  set deleted_at = v_deleted_at,
      status = 'paused',
      updated_at = v_deleted_at
  where l.id = p_listing_id and l.seller_id = v_uid and l.deleted_at is null;
  if not found then
    raise exception 'listing_not_owned_or_removed' using errcode = '42501';
  end if;
  return true;
end;
$$;
revoke all on function public.marketplace_delete_listing(uuid) from public, anon, authenticated;
grant execute on function public.marketplace_delete_listing(uuid) to authenticated;
