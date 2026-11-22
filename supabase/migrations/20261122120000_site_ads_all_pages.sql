-- Allow targeting the existing public/member content pages from the ads studio.
-- This is an additive constraint expansion; it does not create, update, or delete ad rows.
alter table public.site_ads
  drop constraint if exists site_ads_sections_allowed;

alter table public.site_ads
  add constraint site_ads_sections_allowed check (
    coalesce(array_length(sections, 1), 0) > 0
    and sections <@ array[
      'all',
      'home', 'reels', 'discover', 'profile', 'daily', 'marketplace', 'live',
      'assistant', 'audio_rooms', 'landing', 'match', 'messages', 'movies',
      'reel_profile', 'rooms', 'vip', 'vip_live', 'wallet', 'youtube'
    ]::text[]
  );
