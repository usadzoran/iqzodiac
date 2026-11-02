alter table public.discover_news_articles
  add column if not exists image_url text
  check (image_url is null or image_url ~ '^https://');
