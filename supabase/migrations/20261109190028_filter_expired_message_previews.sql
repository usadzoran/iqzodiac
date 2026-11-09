-- Expired rows may wait up to one cron interval for physical deletion.
-- Never show them as a private conversation preview in the meantime.
create or replace function public.list_my_conversations()
returns table(conversation_id uuid, other_user_id uuid, display_name text, handle text, last_message text, last_message_at timestamptz)
language sql security definer set search_path = public as $$
  select c.id, other.user_id, p.display_name, p.handle, lm.body, lm.created_at
  from public.conversations c
  join public.conversation_participants own on own.conversation_id = c.id and own.user_id = auth.uid()
  join public.conversation_participants other on other.conversation_id = c.id and other.user_id <> auth.uid()
  join public.profiles p on p.user_id = other.user_id
  left join lateral (
    select m.body, m.created_at
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
