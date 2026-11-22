-- Expand site ads so one HTML creative can target multiple site sections and placements.
alter table public.site_ads
  add column if not exists sections text[] not null default array['all']::text[],
  add column if not exists placements text[] not null default array[]::text[];

-- Backfill existing records without changing their legacy placement.
update public.site_ads
set
  sections = case
    when placement = 'reels_between' then array['reels']::text[]
    else array['home']::text[]
  end,
  placements = array[placement]::text[]
where coalesce(array_length(placements, 1), 0) = 0;

alter table public.site_ads
  drop constraint if exists site_ads_sections_allowed,
  drop constraint if exists site_ads_placements_allowed;

alter table public.site_ads
  add constraint site_ads_sections_allowed check (
    coalesce(array_length(sections, 1), 0) > 0
    and sections <@ array['all','home','reels','discover','profile','daily','marketplace','live']::text[]
  ),
  add constraint site_ads_placements_allowed check (
    coalesce(array_length(placements, 1), 0) > 0
    and placements <@ array['header','hero','feed_between','reels_between','footer']::text[]
  );

create index if not exists site_ads_active_sections_gin_idx
  on public.site_ads using gin (sections)
  where is_active;

create index if not exists site_ads_active_placements_gin_idx
  on public.site_ads using gin (placements)
  where is_active;
