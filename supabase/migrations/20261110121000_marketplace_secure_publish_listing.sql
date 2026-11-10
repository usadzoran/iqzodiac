create or replace function public.marketplace_publish_listing(p_kind text, p_title text, p_description text, p_category_id uuid, p_price numeric, p_currency_code text, p_pricing_type text, p_condition text, p_country text, p_city text, p_delivery_options text[])
returns uuid language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_uid uuid := auth.uid(); v_category_kind text; v_listing_id uuid;
begin
 if v_uid is null then raise exception 'not_authenticated' using errcode='42501'; end if;
 if p_kind not in ('product','service') then raise exception 'invalid_listing_kind' using errcode='22023'; end if;
 if char_length(trim(coalesce(p_title,''))) < 3 or char_length(trim(p_title)) > 140 then raise exception 'invalid_listing_title' using errcode='22023'; end if;
 if p_price is null or p_price < 0 then raise exception 'invalid_listing_price' using errcode='22023'; end if;
 if p_currency_code is null or p_currency_code !~ '^[A-Z]{3}$' then raise exception 'invalid_currency_code' using errcode='22023'; end if;
 if p_category_id is null then raise exception 'category_required' using errcode='22023'; end if;
 select kind into v_category_kind from public.marketplace_categories where id=p_category_id and is_active;
 if v_category_kind is null or v_category_kind <> p_kind then raise exception 'invalid_category' using errcode='22023'; end if;
 insert into public.marketplace_listings(seller_id,kind,title,description,category_id,price,currency_code,pricing_type,condition,country,city,delivery_options,status)
 values(v_uid,p_kind,trim(p_title),coalesce(trim(p_description),''),p_category_id,p_price,p_currency_code,p_pricing_type,nullif(p_condition,''),coalesce(trim(p_country),''),coalesce(trim(p_city),''),coalesce(p_delivery_options,array['local_pickup']::text[]),'active') returning id into v_listing_id;
 return v_listing_id;
end; $$;
revoke all on function public.marketplace_publish_listing(text,text,text,uuid,numeric,text,text,text,text,text,text[]) from public;
grant execute on function public.marketplace_publish_listing(text,text,text,uuid,numeric,text,text,text,text,text,text[]) to authenticated;
