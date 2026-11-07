-- Categorize live sessions so the live directory can group broadcasts by topic.
alter table public.vip_live_sessions
  add column if not exists category text not null default 'General'
  check (char_length(trim(category)) between 2 and 80);

create index if not exists vip_live_sessions_category_status_idx
  on public.vip_live_sessions (category, status, created_at desc);
