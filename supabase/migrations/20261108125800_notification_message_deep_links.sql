-- Store the exact message that produced a private-message notification so clients
-- can open the conversation and highlight the corresponding message.
alter table public.notifications
  add column if not exists message_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notifications_message_id_fkey'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_message_id_fkey
      foreign key (message_id) references public.messages(id) on delete set null;
  end if;
end $$;

create index if not exists notifications_message_id_idx
  on public.notifications (message_id)
  where message_id is not null;

create or replace function public.iqzodiac_create_private_message_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_recipient uuid;
  v_actor_name text;
begin
  select cp.user_id into v_recipient
  from public.conversation_participants cp
  where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id
  order by cp.user_id limit 1;

  if v_recipient is null then return new; end if;

  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.handle), ''), 'Someone')
    into v_actor_name
  from public.profiles p
  where p.user_id = new.sender_id;

  insert into public.notifications (recipient_id, actor_id, notification_type, message, message_id)
  values (
    v_recipient,
    new.sender_id,
    'private_message',
    coalesce(v_actor_name, 'Someone') || ' sent you a private message.',
    new.id
  );
  return new;
end;
$$;

revoke all on function public.iqzodiac_create_private_message_notification()
  from public, anon, authenticated;
