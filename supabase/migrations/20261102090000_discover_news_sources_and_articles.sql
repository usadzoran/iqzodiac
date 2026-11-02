create extension if not exists pgcrypto;

create table if not exists public.discover_news_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique check (source_key ~ '^[a-z0-9-]+$'),
  category text not null check (category in ('US News', 'World News', 'Special Categories')),
  name text not null check (char_length(trim(name)) between 1 and 120),
  rss_url text not null unique check (rss_url ~ '^https://'),
  language text not null default 'en' check (language = 'en'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discover_news_articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.discover_news_sources(id) on delete cascade,
  external_id text not null check (char_length(trim(external_id)) between 1 and 1000),
  title text not null check (char_length(trim(title)) between 1 and 500),
  description text not null default '' check (char_length(description) <= 4000),
  article_url text not null check (article_url ~ '^https://'),
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  language text not null default 'en' check (language = 'en'),
  unique (source_id, external_id)
);

create index if not exists discover_news_sources_category_idx on public.discover_news_sources(category, name);
create index if not exists discover_news_articles_published_idx on public.discover_news_articles(published_at desc nulls last);
create index if not exists discover_news_articles_source_idx on public.discover_news_articles(source_id, fetched_at desc);

alter table public.discover_news_sources enable row level security;
alter table public.discover_news_sources force row level security;
alter table public.discover_news_articles enable row level security;
alter table public.discover_news_articles force row level security;

drop policy if exists "Authenticated members read discover news sources" on public.discover_news_sources;
create policy "Authenticated members read discover news sources" on public.discover_news_sources for select to authenticated using (true);
drop policy if exists "Authenticated members read discover news articles" on public.discover_news_articles;
create policy "Authenticated members read discover news articles" on public.discover_news_articles for select to authenticated using (true);
drop policy if exists "Authenticated members sync discover news articles" on public.discover_news_articles;
create policy "Authenticated members sync discover news articles" on public.discover_news_articles for insert to authenticated with check (language = 'en');
drop policy if exists "Authenticated members refresh discover news articles" on public.discover_news_articles;
create policy "Authenticated members refresh discover news articles" on public.discover_news_articles for update to authenticated using (true) with check (language = 'en');

insert into public.discover_news_sources (source_key, category, name, rss_url, language, is_active)
values
  ('npr', 'US News', 'NPR', 'https://feeds.npr.org/1001/rss.xml', 'en', true),
  ('nbc-news', 'US News', 'NBC News', 'https://feeds.nbcnews.com/nbcnews/public/news', 'en', true),
  ('abc-news', 'US News', 'ABC News', 'https://abcnews.go.com/abcnews/topstories', 'en', true),
  ('cbs-news', 'US News', 'CBS News', 'https://www.cbsnews.com/latest/rss/main', 'en', true),
  ('new-york-times-homepage', 'US News', 'New York Times', 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', 'en', true),
  ('bbc-world', 'World News', 'BBC World', 'https://feeds.bbci.co.uk/news/world/rss.xml', 'en', true),
  ('al-jazeera', 'World News', 'Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml', 'en', true),
  ('the-guardian', 'World News', 'The Guardian', 'https://www.theguardian.com/world/rss', 'en', true),
  ('deutsche-welle', 'World News', 'Deutsche Welle', 'https://rss.dw.com/xml/rss-en-all', 'en', true),
  ('technology', 'Special Categories', 'Technology', 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', 'en', true),
  ('business', 'Special Categories', 'Business', 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', 'en', true),
  ('politics', 'Special Categories', 'Politics', 'https://rss.politico.com/politics-news.xml', 'en', true)
on conflict (source_key) do update set category = excluded.category, name = excluded.name, rss_url = excluded.rss_url, language = 'en', is_active = excluded.is_active, updated_at = now();

grant select on table public.discover_news_sources, public.discover_news_articles to authenticated;
grant insert, update on table public.discover_news_articles to authenticated;
