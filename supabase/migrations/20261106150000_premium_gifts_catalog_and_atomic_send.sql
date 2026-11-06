-- IQZodiac premium gifts catalog and atomic server-side sending.
-- Additive only. This migration is intentionally fail-closed until the live provider
-- and gift backend readiness flags are enabled by an authorized operator.

alter table public.vip_gifts
  add column if not exists name_en text,
  add column if not exists name_ar text,
  add column if not exists description_en text not null default '',
  add column if not exists description_ar text not null default '',
  add column if not exists usd_value numeric(8,2),
  add column if not exists gift_level smallint,
  add column if not exists animation_type text not null default 'small_float',
  add column if not exists animation_level text not null default 'small',
  add column if not exists asset_path text;

alter table public.vip_gift_transactions
  add column if not exists quantity integer not null default 1,
  add column if not exists total_price_coins bigint,
  add column if not exists usd_value_snapshot numeric(14,2),
  add column if not exists total_usd_value numeric(14,2),
  add column if not exists creator_earnings_usd numeric(14,2),
  add column if not exists platform_commission_usd numeric(14,2),
  add column if not exists message text;

create table if not exists public.vip_gift_conversion_settings (
  singleton boolean primary key default true check (singleton),
  coins_per_usd numeric(14,4) not null default 100 check (coins_per_usd > 0),
  creator_share_percent numeric(5,2) not null default 90 check (creator_share_percent between 0 and 100),
  platform_share_percent numeric(5,2) not null default 10 check (platform_share_percent between 0 and 100),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (creator_share_percent + platform_share_percent = 100)
);

create table if not exists public.vip_gift_earnings_usd_ledger (
  id uuid primary key default gen_random_uuid(),
  gift_transaction_id uuid not null unique references public.vip_gift_transactions(id) on delete restrict,
  creator_user_id uuid not null references auth.users(id) on delete restrict,
  recognized_gross_usd numeric(14,2) not null check (recognized_gross_usd > 0),
  creator_share_percent numeric(5,2) not null check (creator_share_percent between 0 and 100),
  platform_share_percent numeric(5,2) not null check (platform_share_percent between 0 and 100),
  creator_earnings_usd numeric(14,2) not null check (creator_earnings_usd >= 0),
  platform_commission_usd numeric(14,2) not null check (platform_commission_usd >= 0),
  status text not null default 'available' check (status in ('available','reversed')),
  created_at timestamptz not null default now(),
  check (round(creator_earnings_usd + platform_commission_usd, 2) = recognized_gross_usd),
  check (creator_share_percent + platform_share_percent = 100)
);

create index if not exists vip_gifts_level_order_idx on public.vip_gifts (gift_level, sort_order);
create index if not exists vip_gift_transactions_session_created_idx on public.vip_gift_transactions (live_session_id, created_at desc);
create index if not exists vip_gift_earnings_creator_created_idx on public.vip_gift_earnings_usd_ledger (creator_user_id, created_at desc);

insert into public.vip_gift_conversion_settings (singleton, coins_per_usd, creator_share_percent, platform_share_percent)
values (true, 100, 90, 10)
on conflict (singleton) do nothing;

-- Catalog seed: 10 price levels, exactly 3 gifts per level, 30 unique gift codes.
insert into public.vip_gifts
  (gift_code, name, name_en, name_ar, category, description_en, description_ar, usd_value,
   price_coins, gift_level, animation_type, animation_level, icon_asset_ref, asset_path, is_active, sort_order)
values
('red-rose','Red Rose','Red Rose','وردة حمراء','level-1','A luminous rose for a warm hello.','وردة مضيئة لتحية دافئة.',0.50,50,1,'small_float','small','red-rose','/assets/gifts/red-rose.svg',true,101),
('little-heart','Little Heart','Little Heart','قلب صغير','level-1','A tiny heart with a bright sparkle.','قلب صغير مع بريق لامع.',0.50,50,1,'small_float','small','little-heart','/assets/gifts/little-heart.svg',true,102),
('magic-butterfly','Magic Butterfly','Magic Butterfly','فراشة سحرية','level-1','A magical butterfly drifting through the room.','فراشة سحرية تحلّق في الغرفة.',0.50,50,1,'sparkle_drift','small','magic-butterfly','/assets/gifts/magic-butterfly.svg',true,103),
('teddy-bear','Teddy Bear','Teddy Bear','دب لطيف','level-2','A glossy little bear made for sweet moments.','دب لامع للحظات الجميلة.',1.00,100,2,'small_float','small','teddy-bear','/assets/gifts/teddy-bear.svg',true,201),
('golden-star','Golden Star','Golden Star','نجمة ذهبية','level-2','A golden star that twinkles above the stream.','نجمة ذهبية تتلألأ فوق البث.',1.00,100,2,'sparkle_burst','small','golden-star','/assets/gifts/golden-star.svg',true,202),
('love-letter','Love Letter','Love Letter','رسالة حب','level-2','A sealed note wrapped in a soft glow.','رسالة مختومة بهالة ناعمة.',1.00,100,2,'float_ribbon','small','love-letter','/assets/gifts/love-letter.svg',true,203),
('flower-bouquet','Flower Bouquet','Flower Bouquet','باقة زهور','level-3','A radiant bouquet blooming in the live room.','باقة متوهجة تتفتح في غرفة البث.',1.50,150,3,'screen_sweep','medium','flower-bouquet','/assets/gifts/flower-bouquet.svg',true,301),
('birthday-cake','Birthday Cake','Birthday Cake','كعكة عيد ميلاد','level-3','A celebration cake with magical candles.','كعكة احتفالية بشموع سحرية.',1.50,150,3,'confetti_sweep','medium','birthday-cake','/assets/gifts/birthday-cake.svg',true,302),
('diamond-ring','Diamond Ring','Diamond Ring','خاتم ألماس','level-3','A diamond ring tracing a bright arc.','خاتم ألماس يرسم قوسًا مضيئًا.',1.50,150,3,'screen_sweep','medium','diamond-ring','/assets/gifts/diamond-ring.svg',true,303),
('luxury-perfume','Luxury Perfume','Luxury Perfume','عطر فاخر','level-4','A refined bottle wrapped in violet mist.','زجاجة فاخرة يلفها ضباب بنفسجي.',2.00,200,4,'screen_sweep','medium','luxury-perfume','/assets/gifts/luxury-perfume.svg',true,401),
('golden-trophy','Golden Trophy','Golden Trophy','كأس ذهبي','level-4','A polished trophy for a winning moment.','كأس مصقول للحظة انتصار.',2.00,200,4,'golden_rise','medium','golden-trophy','/assets/gifts/golden-trophy.svg',true,402),
('love-swan','Love Swan','Love Swan','بجعة الحب','level-4','Two luminous wings forming a graceful swan.','جناحان مضيئان يشكلان بجعة أنيقة.',2.00,200,4,'wing_glide','medium','love-swan','/assets/gifts/love-swan.svg',true,403),
('blue-diamond','Blue Diamond','Blue Diamond','ألماسة زرقاء','level-5','A cool blue gem with crystalline light.','جوهرة زرقاء بضياء بلوري.',2.50,250,5,'crystal_burst','medium','blue-diamond','/assets/gifts/blue-diamond.svg',true,501),
('magic-unicorn','Magic Unicorn','Magic Unicorn','وحيد القرن السحري','level-5','A dreamy unicorn crossing a rainbow trail.','وحيد قرن حالم يعبر أثرًا قزحيًا.',2.50,250,5,'rainbow_sweep','medium','magic-unicorn','/assets/gifts/magic-unicorn.svg',true,502),
('angel-wings','Angel Wings','Angel Wings','أجنحة ملاك','level-5','Soft celestial wings opening in light.','أجنحة سماوية ناعمة تنفتح وسط النور.',2.50,250,5,'wing_glide','medium','angel-wings','/assets/gifts/angel-wings.svg',true,503),
('royal-crown','Royal Crown','Royal Crown','تاج ملكي','level-6','A crown with a regal violet aura.','تاج بهالة بنفسجية ملكية.',3.00,300,6,'prominent_rise','premium','royal-crown','/assets/gifts/royal-crown.svg',true,601),
('luxury-yacht','Luxury Yacht','Luxury Yacht','يخت فاخر','level-6','A polished yacht sailing across starlight.','يخت مصقول يبحر بين النجوم.',3.00,300,6,'horizon_sweep','premium','luxury-yacht','/assets/gifts/luxury-yacht.svg',true,602),
('golden-phoenix','Golden Phoenix','Golden Phoenix','العنقاء الذهبية','level-6','A phoenix rising through a golden flare.','عنقاء تنهض وسط وهج ذهبي.',3.00,300,6,'phoenix_rise','premium','golden-phoenix','/assets/gifts/golden-phoenix.svg',true,603),
('sports-car','Sports Car','Sports Car','سيارة رياضية','level-7','A neon sports car racing through light.','سيارة رياضية نيون تنطلق عبر الضوء.',3.50,350,7,'neon_drive','premium','sports-car','/assets/gifts/sports-car.svg',true,701),
('golden-dragon','Golden Dragon','Golden Dragon','تنين ذهبي','level-7','A legendary dragon circling the room.','تنين أسطوري يدور حول الغرفة.',3.50,350,7,'dragon_orbit','premium','golden-dragon','/assets/gifts/golden-dragon.svg',true,702),
('diamond-necklace','Diamond Necklace','Diamond Necklace','قلادة ألماس','level-7','A cascade of diamonds in midnight blue.','شلال من الألماس في أزرق الليل.',3.50,350,7,'crystal_cascade','premium','diamond-necklace','/assets/gifts/diamond-necklace.svg',true,703),
('private-jet','Private Jet','Private Jet','طائرة خاصة','level-8','A silver jet streaking across the galaxy.','طائرة فضية تشق المجرة.',4.00,400,8,'galaxy_sweep','premium','private-jet','/assets/gifts/private-jet.svg',true,801),
('fantasy-castle','Fantasy Castle','Fantasy Castle','قلعة خيالية','level-8','A luminous castle rising from a dream.','قلعة مضيئة تنهض من حلم.',4.00,400,8,'castle_reveal','premium','fantasy-castle','/assets/gifts/fantasy-castle.svg',true,802),
('golden-lion','Golden Lion','Golden Lion','أسد ذهبي','level-8','A proud lion crowned in solar fire.','أسد شامخ متوج بنار شمسية.',4.00,400,8,'lion_roar','premium','golden-lion','/assets/gifts/golden-lion.svg',true,803),
('royal-heart','Royal Heart','Royal Heart','القلب الملكي','level-9','A royal heart surrounded by cosmic sparks.','قلب ملكي تحيط به شرارات كونية.',4.50,450,9,'cosmic_heart','legendary','royal-heart','/assets/gifts/royal-heart.svg',true,901),
('galaxy-planet','Galaxy Planet','Galaxy Planet','كوكب المجرة','level-9','A living planet with a violet halo.','كوكب نابض بهالة بنفسجية.',4.50,450,9,'planet_orbit','legendary','galaxy-planet','/assets/gifts/galaxy-planet.svg',true,902),
('diamond-throne','Diamond Throne','Diamond Throne','عرش ألماسي','level-9','A throne carved from starlight.','عرش منحوت من ضوء النجوم.',4.50,450,9,'throne_reveal','legendary','diamond-throne','/assets/gifts/diamond-throne.svg',true,903),
('cosmic-galaxy-portal','Cosmic Galaxy Portal','Cosmic Galaxy Portal','بوابة المجرة الكونية','level-10','A portal opening into an infinite galaxy.','بوابة تفتح على مجرة لا نهائية.',5.00,500,10,'cosmic_portal','legendary','cosmic-galaxy-portal','/assets/gifts/cosmic-galaxy-portal.svg',true,1001),
('legendary-royal-palace','Legendary Royal Palace','Legendary Royal Palace','القصر الملكي الأسطوري','level-10','A palace of light for the grandest entrance.','قصر من النور لأفخم دخول.',5.00,500,10,'palace_celebration','legendary','legendary-royal-palace','/assets/gifts/legendary-royal-palace.svg',true,1002),
('celestial-phoenix-wings','Celestial Phoenix Wings','Celestial Phoenix Wings','أجنحة العنقاء السماوية','level-10','Celestial wings igniting a legendary finale.','أجنحة سماوية تشعل خاتمة أسطورية.',5.00,500,10,'celestial_phoenix','legendary','celestial-phoenix-wings','/assets/gifts/celestial-phoenix-wings.svg',true,1003)
on conflict (gift_code) do update set
  name=excluded.name, name_en=excluded.name_en, name_ar=excluded.name_ar,
  description_en=excluded.description_en, description_ar=excluded.description_ar,
  usd_value=excluded.usd_value, price_coins=excluded.price_coins, gift_level=excluded.gift_level,
  animation_type=excluded.animation_type, animation_level=excluded.animation_level,
  icon_asset_ref=excluded.icon_asset_ref, asset_path=excluded.asset_path,
  is_active=excluded.is_active, sort_order=excluded.sort_order, updated_at=now();

alter table public.vip_gift_conversion_settings enable row level security;
alter table public.vip_gift_conversion_settings force row level security;
alter table public.vip_gift_earnings_usd_ledger enable row level security;
alter table public.vip_gift_earnings_usd_ledger force row level security;
revoke all on public.vip_gift_conversion_settings, public.vip_gift_earnings_usd_ledger from anon, authenticated;
grant select on public.vip_gift_conversion_settings to authenticated;
grant select on public.vip_gift_earnings_usd_ledger to authenticated;
drop policy if exists vip_gift_conversion_read_admin on public.vip_gift_conversion_settings;
create policy vip_gift_conversion_read_admin on public.vip_gift_conversion_settings for select to authenticated using (public.iqzodiac_vip_has_role('admin'));
drop policy if exists vip_gift_earnings_read_owner_or_admin on public.vip_gift_earnings_usd_ledger;
create policy vip_gift_earnings_read_owner_or_admin on public.vip_gift_earnings_usd_ledger for select to authenticated using (creator_user_id = auth.uid() or public.iqzodiac_vip_has_role('admin'));

create or replace function public.iqzodiac_send_live_gift(
  p_live_session_id uuid, p_gift_id uuid, p_quantity integer default 1,
  p_idempotency_key text default null, p_message text default null
) returns public.vip_gift_transactions
language plpgsql security definer set search_path = pg_catalog, public, auth
as $$
declare
  v_sender uuid := auth.uid(); v_session public.vip_live_sessions%rowtype; v_gift public.vip_gifts%rowtype;
  v_wallet public.vip_wallets%rowtype; v_rule public.vip_gift_conversion_settings%rowtype;
  v_existing public.vip_gift_transactions%rowtype; v_tx public.vip_gift_transactions%rowtype;
  v_total bigint; v_total_usd numeric(14,2); v_creator numeric(14,2); v_platform numeric(14,2);
  v_ledger_id uuid;
begin
  if v_sender is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_quantity is null or p_quantity not between 1 and 20 then raise exception 'invalid_quantity' using errcode='22023'; end if;
  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) not between 8 and 200 then raise exception 'invalid_idempotency_key' using errcode='22023'; end if;
  if p_message is not null and char_length(p_message) > 500 then raise exception 'message_too_long' using errcode='22023'; end if;
  if not exists (select 1 from public.vip_feature_status where singleton and live_streaming_enabled and gift_sending_enabled and live_provider_ready and gift_backend_ready) then raise exception 'gift_backend_not_ready' using errcode='55000'; end if;
  select * into v_existing from public.vip_gift_transactions where idempotency_key=trim(p_idempotency_key) limit 1;
  if found then if v_existing.sender_user_id <> v_sender or v_existing.live_session_id <> p_live_session_id or v_existing.gift_id <> p_gift_id or v_existing.quantity <> p_quantity then raise exception 'idempotency_key_conflict' using errcode='23505'; end if; return v_existing; end if;
  select * into v_session from public.vip_live_sessions where id=p_live_session_id and status='live' for share;
  if not found then raise exception 'live_session_not_active' using errcode='55000'; end if;
  if v_session.host_user_id = v_sender then raise exception 'self_gifting_not_allowed' using errcode='22023'; end if;
  select * into v_gift from public.vip_gifts where id=p_gift_id and is_active for share;
  if not found then raise exception 'gift_not_available' using errcode='22023'; end if;
  select * into v_rule from public.vip_gift_conversion_settings where singleton=true;
  v_total := v_gift.price_coins * p_quantity;
  v_total_usd := round(v_gift.usd_value * p_quantity, 2);
  v_creator := round(v_total_usd * v_rule.creator_share_percent / 100, 2);
  v_platform := v_total_usd - v_creator;
  perform pg_advisory_xact_lock(hashtextextended(v_sender::text, 0));
  select * into v_wallet from public.vip_wallets where user_id=v_sender for update;
  if not found or v_wallet.spendable_coins < v_total then raise exception 'insufficient_coins' using errcode='22023'; end if;
  update public.vip_wallets set spendable_coins=spendable_coins-v_total, updated_at=now() where user_id=v_sender;
  insert into public.vip_gift_transactions(sender_user_id,recipient_user_id,live_session_id,gift_id,gift_code_snapshot,gift_name_snapshot,price_coins_snapshot,creator_share_percent,platform_share_percent,creator_share_coins,platform_share_coins,status,idempotency_key,settled_at,quantity,total_price_coins,usd_value_snapshot,total_usd_value,creator_earnings_usd,platform_commission_usd,message)
  values(v_sender,v_session.host_user_id,p_live_session_id,v_gift.id,v_gift.gift_code,coalesce(v_gift.name_en,v_gift.name),v_gift.price_coins,v_rule.creator_share_percent,v_rule.platform_share_percent,round(v_gift.price_coins*p_quantity*v_rule.creator_share_percent/100),v_total-round(v_gift.price_coins*p_quantity*v_rule.creator_share_percent/100),'settled',trim(p_idempotency_key),now(),p_quantity,v_total,v_gift.usd_value,v_total_usd,v_creator,v_platform,nullif(trim(p_message),'')) returning * into v_tx;
  insert into public.vip_wallet_ledger(user_id,delta_coins,entry_type,reference_type,reference_id,idempotency_key,actor_user_id) values(v_sender,-v_total,'gift_debit','gift_transaction',v_tx.id,'gift-debit:'||trim(p_idempotency_key),v_sender);
  insert into public.vip_gift_earnings_usd_ledger(gift_transaction_id,creator_user_id,recognized_gross_usd,creator_share_percent,platform_share_percent,creator_earnings_usd,platform_commission_usd) values(v_tx.id,v_session.host_user_id,v_total_usd,v_rule.creator_share_percent,v_rule.platform_share_percent,v_creator,v_platform) returning id into v_ledger_id;
  return v_tx;
end; $$;
revoke all on function public.iqzodiac_send_live_gift(uuid,uuid,integer,text,text) from public, anon;
grant execute on function public.iqzodiac_send_live_gift(uuid,uuid,integer,text,text) to authenticated;
comment on function public.iqzodiac_send_live_gift(uuid,uuid,integer,text,text) is 'Authenticated, idempotent, atomic gift send. Prices and recipient are resolved server-side.';
