-- IQZodiac Marketplace core. No existing marketplace tables were found.
create extension if not exists pgcrypto;

create table if not exists public.marketplace_categories (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('product','service')),
  slug text not null,
  name_en text not null,
  name_ar text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (kind, slug)
);

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('product','service')),
  title text not null check (char_length(trim(title)) between 3 and 140),
  description text not null default '' check (char_length(description) <= 10000),
  category_id uuid references public.marketplace_categories(id) on delete set null,
  price numeric(14,2) not null check (price >= 0),
  currency_code text not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
  pricing_type text not null default 'fixed' check (pricing_type in ('fixed','hourly','starting_from','contact')),
  condition text check (condition is null or condition in ('new','like_new','used')),
  brand text check (brand is null or char_length(brand) <= 100),
  quantity integer not null default 1 check (quantity > 0),
  country text not null default '' check (char_length(country) <= 120),
  city text not null default '' check (char_length(city) <= 120),
  delivery_options text[] not null default array['local_pickup']::text[],
  shipping_cost numeric(14,2) check (shipping_cost is null or shipping_cost >= 0),
  service_area text,
  remote_service boolean not null default false,
  status text not null default 'active' check (status in ('draft','active','paused','sold','completed')),
  featured boolean not null default false,
  views_count integer not null default 0 check (views_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_listings_active_idx on public.marketplace_listings (status, created_at desc);
create index if not exists marketplace_listings_category_idx on public.marketplace_listings (category_id, created_at desc);
create index if not exists marketplace_listings_location_idx on public.marketplace_listings (country, city);

create table if not exists public.marketplace_listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  storage_path text not null,
  alt_text text not null default '',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (listing_id, storage_path)
);

create table if not exists public.marketplace_favorites (
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);

create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete restrict,
  seller_id uuid not null references auth.users(id) on delete restrict,
  listing_id uuid not null references public.marketplace_listings(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  subtotal numeric(14,2) not null check (subtotal >= 0),
  shipping_cost numeric(14,2) not null default 0 check (shipping_cost >= 0),
  total numeric(14,2) not null check (total >= 0),
  status text not null default 'pending' check (status in ('pending','confirmed','processing','shipped','completed','cancelled','refunded')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','failed','refunded')),
  delivery_method text not null default 'local_pickup' check (delivery_method in ('shipping','local_pickup','digital_delivery')),
  buyer_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_service_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete restrict,
  buyer_id uuid not null references auth.users(id) on delete restrict,
  seller_id uuid not null references auth.users(id) on delete restrict,
  requested_for timestamptz,
  details text not null default '' check (char_length(details) <= 5000),
  status text not null default 'pending' check (status in ('pending','accepted','scheduled','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  unique (order_id, reviewer_id)
);

create table if not exists public.marketplace_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 2 and 120),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);

insert into public.marketplace_categories (kind, slug, name_en, name_ar, sort_order) values
 ('product','electronics','Electronics','إلكترونيات',10),('product','phones-computers','Phones & Computers','هواتف وحواسيب',20),('product','vehicles','Vehicles','مركبات',30),('product','fashion-accessories','Fashion & Accessories','أزياء وإكسسوارات',40),('product','home-furniture','Home & Furniture','منزل وأثاث',50),('product','sports-fitness','Sports & Fitness','رياضة ولياقة',60),('product','beauty-care','Beauty & Personal Care','جمال وعناية شخصية',70),('product','books-education','Books & Education','كتب وتعليم',80),('product','other-products','Other Products','منتجات أخرى',90),
 ('service','web-development','Web Development','تطوير الويب',110),('service','graphic-design','Graphic Design','تصميم جرافيك',120),('service','digital-marketing','Digital Marketing','تسويق رقمي',130),('service','photography','Photography','تصوير',140),('service','delivery','Delivery','توصيل',150),('service','education-courses','Education & Courses','تعليم ودورات',160),('service','professional-services','Professional Services','خدمات مهنية',170),('service','beauty-services','Beauty Services','خدمات تجميل',180),('service','other-services','Other Services','خدمات أخرى',190)
on conflict (kind, slug) do nothing;

alter table public.marketplace_categories enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_listing_images enable row level security;
alter table public.marketplace_favorites enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_service_requests enable row level security;
alter table public.marketplace_reviews enable row level security;
alter table public.marketplace_reports enable row level security;

create policy marketplace_categories_public_read on public.marketplace_categories for select to authenticated using (is_active or public.iqzodiac_is_admin());
create policy marketplace_categories_admin_write on public.marketplace_categories for all to authenticated using (public.iqzodiac_is_admin()) with check (public.iqzodiac_is_admin());
create policy marketplace_listings_public_read on public.marketplace_listings for select to authenticated using (status = 'active' or seller_id = auth.uid() or public.iqzodiac_is_admin());
create policy marketplace_listings_owner_insert on public.marketplace_listings for insert to authenticated with check (seller_id = auth.uid());
create policy marketplace_listings_owner_update on public.marketplace_listings for update to authenticated using (seller_id = auth.uid() or public.iqzodiac_is_admin()) with check (seller_id = auth.uid() or public.iqzodiac_is_admin());
create policy marketplace_listings_owner_delete on public.marketplace_listings for delete to authenticated using (seller_id = auth.uid() or public.iqzodiac_is_admin());
create policy marketplace_images_read on public.marketplace_listing_images for select to authenticated using (exists (select 1 from public.marketplace_listings l where l.id = listing_id and (l.status = 'active' or l.seller_id = auth.uid() or public.iqzodiac_is_admin())));
create policy marketplace_images_owner_write on public.marketplace_listing_images for all to authenticated using (exists (select 1 from public.marketplace_listings l where l.id = listing_id and (l.seller_id = auth.uid() or public.iqzodiac_is_admin()))) with check (exists (select 1 from public.marketplace_listings l where l.id = listing_id and (l.seller_id = auth.uid() or public.iqzodiac_is_admin())));
create policy marketplace_favorites_own on public.marketplace_favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy marketplace_orders_parties on public.marketplace_orders for select to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid() or public.iqzodiac_is_admin());
create policy marketplace_orders_buyer_insert on public.marketplace_orders for insert to authenticated with check (buyer_id = auth.uid() and payment_status = 'unpaid');
create policy marketplace_orders_party_update on public.marketplace_orders for update to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid() or public.iqzodiac_is_admin()) with check (buyer_id = auth.uid() or seller_id = auth.uid() or public.iqzodiac_is_admin());
create policy marketplace_requests_parties on public.marketplace_service_requests for select to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid() or public.iqzodiac_is_admin());
create policy marketplace_requests_buyer_insert on public.marketplace_service_requests for insert to authenticated with check (buyer_id = auth.uid());
create policy marketplace_requests_party_update on public.marketplace_service_requests for update to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid() or public.iqzodiac_is_admin()) with check (buyer_id = auth.uid() or seller_id = auth.uid() or public.iqzodiac_is_admin());
create policy marketplace_reviews_read on public.marketplace_reviews for select to authenticated using (true);
create policy marketplace_reviews_buyer_insert on public.marketplace_reviews for insert to authenticated with check (reviewer_id = auth.uid());
create policy marketplace_reports_own_insert on public.marketplace_reports for insert to authenticated with check (reporter_id = auth.uid());
create policy marketplace_reports_own_read on public.marketplace_reports for select to authenticated using (reporter_id = auth.uid() or public.iqzodiac_is_admin());
create policy marketplace_reports_admin_update on public.marketplace_reports for update to authenticated using (public.iqzodiac_is_admin()) with check (public.iqzodiac_is_admin());

insert into storage.buckets (id, name, public) values ('marketplace-media','marketplace-media',false) on conflict (id) do nothing;
create policy marketplace_storage_read on storage.objects for select to authenticated using (bucket_id = 'marketplace-media');
create policy marketplace_storage_insert on storage.objects for insert to authenticated with check (bucket_id = 'marketplace-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy marketplace_storage_delete on storage.objects for delete to authenticated using (bucket_id = 'marketplace-media' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.marketplace_increment_view(p_listing_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.marketplace_listings set views_count = views_count + 1, updated_at = now() where id = p_listing_id and status = 'active';
$$;
revoke all on function public.marketplace_increment_view(uuid) from public, anon;
grant execute on function public.marketplace_increment_view(uuid) to authenticated;
