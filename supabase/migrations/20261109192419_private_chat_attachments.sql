-- Private attachments for direct conversations. Storage object names are
-- conversation_id/sender_id/random-id-filename and are never publicly readable.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'iqzodiac-chat-media',
  'iqzodiac-chat-media',
  false,
  26214400,
  array[
    'image/jpeg','image/png','image/webp','image/gif',
    'audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/webm','audio/aac','audio/flac','audio/x-m4a',
    'application/octet-stream','application/pdf','text/plain','text/csv',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_mime text,
  add column if not exists attachment_size_bytes bigint,
  add column if not exists attachment_kind text;

alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages
  add constraint messages_body_check
  check (char_length(trim(body)) <= 600 and (char_length(trim(body)) > 0 or attachment_path is not null));

alter table public.messages drop constraint if exists messages_attachment_metadata_check;
alter table public.messages
  add constraint messages_attachment_metadata_check check (
    (attachment_path is null and attachment_name is null and attachment_mime is null and attachment_size_bytes is null and attachment_kind is null)
    or (
      attachment_path is not null and attachment_name is not null and attachment_mime is not null and attachment_kind is not null and attachment_size_bytes is not null
      and char_length(attachment_name) between 1 and 180
      and attachment_size_bytes between 1 and 26214400
      and attachment_kind in ('image','audio','file')
      and split_part(attachment_path, '/', 3) <> ''
      and (
        (attachment_kind = 'image' and attachment_mime in ('image/jpeg','image/png','image/webp','image/gif') and attachment_size_bytes <= 12582912)
        or (attachment_kind = 'audio' and attachment_mime in ('audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/webm','audio/aac','audio/flac','audio/x-m4a'))
        or (attachment_kind = 'file' and attachment_mime in (
          'application/octet-stream','application/pdf','text/plain','text/csv',
          'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ))
      )
    )
  );

create index if not exists messages_attachment_path_idx
  on public.messages (attachment_path) where attachment_path is not null;

-- Client-side inserts are text-only; the verified Edge Function inserts media rows.
drop policy if exists "Participants send messages" on public.messages;
create policy "Participants send messages" on public.messages
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and message_kind = 'user'
    and public.is_conversation_participant(conversation_id, auth.uid())
    and attachment_path is null
    and attachment_name is null
    and attachment_mime is null
    and attachment_size_bytes is null
    and attachment_kind is null
  );

-- Upload only to the current sender's namespace within a conversation they join.
drop policy if exists iqzodiac_chat_media_insert on storage.objects;
create policy iqzodiac_chat_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'iqzodiac-chat-media'
    and split_part(name, '/', 2) = auth.uid()::text
    and split_part(name, '/', 3) <> ''
    and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.is_conversation_participant(case when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then split_part(name, '/', 1)::uuid else null end, auth.uid())
  );

-- A participant can read an object only while it belongs to a visible, unexpired
-- message in that conversation. Clients request signed URLs for at most 300 seconds;
-- tokens already issued remain usable until token expiry (or object deletion).
drop policy if exists iqzodiac_chat_media_read on storage.objects;
create policy iqzodiac_chat_media_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'iqzodiac-chat-media'
    and exists (
      select 1 from public.messages m
      where m.attachment_path = storage.objects.name
        and m.message_kind = 'user'
        and (m.expires_at is null or m.expires_at > now())
        and public.is_conversation_participant(m.conversation_id, auth.uid())
        and not exists (
          select 1 from public.message_user_hides h
          where h.conversation_id = m.conversation_id
            and h.message_id = m.id
            and h.user_id = auth.uid()
        )
    )
  );

-- Only the original uploader can remove an attachment object. The global-delete
-- RPC only permits deletion of the sender's own message rows.
drop policy if exists iqzodiac_chat_media_delete on storage.objects;
create policy iqzodiac_chat_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'iqzodiac-chat-media'
    and split_part(name, '/', 2) = auth.uid()::text
    and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.is_conversation_participant(case when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then split_part(name, '/', 1)::uuid else null end, auth.uid())
  );

-- Use a safe, human-readable preview without exposing a storage path or signed URL.
create or replace function public.list_my_conversations()
returns table(conversation_id uuid, other_user_id uuid, display_name text, handle text, last_message text, last_message_at timestamptz)
language sql security definer set search_path = public as $$
  select c.id, other.user_id, p.display_name, p.handle,
    coalesce(nullif(lm.body, ''), case lm.attachment_kind
      when 'image' then '[Image]'
      when 'audio' then '[Audio]'
      when 'file' then coalesce(lm.attachment_name, '[File]')
      else null end),
    lm.created_at
  from public.conversations c
  join public.conversation_participants own on own.conversation_id = c.id and own.user_id = auth.uid()
  join public.conversation_participants other on other.conversation_id = c.id and other.user_id <> auth.uid()
  join public.profiles p on p.user_id = other.user_id
  left join lateral (
    select m.body, m.created_at, m.attachment_kind, m.attachment_name
    from public.messages m
    where m.conversation_id = c.id
      and m.message_kind = 'user'
      and (m.expires_at is null or m.expires_at > now())
      and not exists (
        select 1 from public.message_user_hides h
        where h.conversation_id = c.id and h.message_id = m.id and h.user_id = auth.uid()
      )
    order by m.created_at desc
    limit 1
  ) lm on true
  order by coalesce(lm.created_at, c.created_at) desc;
$$;
revoke all on function public.list_my_conversations() from public, anon;
grant execute on function public.list_my_conversations() to authenticated;
