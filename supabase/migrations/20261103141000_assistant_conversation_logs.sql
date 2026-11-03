create table if not exists public.assistant_conversation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null default gen_random_uuid(),
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(trim(content)) between 1 and 4000),
  intent text check (intent is null or intent in ('site_help', 'youtube_search', 'media_search')),
  results jsonb not null default '[]'::jsonb check (jsonb_typeof(results) = 'array'),
  created_at timestamptz not null default now()
);

create index if not exists assistant_conversation_logs_user_created_idx
  on public.assistant_conversation_logs (user_id, created_at desc);

create index if not exists assistant_conversation_logs_conversation_created_idx
  on public.assistant_conversation_logs (conversation_id, created_at asc);

alter table public.assistant_conversation_logs enable row level security;
alter table public.assistant_conversation_logs force row level security;

drop policy if exists "Members read own assistant logs" on public.assistant_conversation_logs;
create policy "Members read own assistant logs"
  on public.assistant_conversation_logs
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Members insert own assistant logs" on public.assistant_conversation_logs;
create policy "Members insert own assistant logs"
  on public.assistant_conversation_logs
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Members delete own assistant logs" on public.assistant_conversation_logs;
create policy "Members delete own assistant logs"
  on public.assistant_conversation_logs
  for delete to authenticated
  using (auth.uid() = user_id);

revoke all on table public.assistant_conversation_logs from anon;
grant select, insert, delete on table public.assistant_conversation_logs to authenticated;
