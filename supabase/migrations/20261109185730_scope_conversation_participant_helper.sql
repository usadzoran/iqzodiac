-- Do not allow authenticated callers to probe whether arbitrary users belong
-- to conversations. Policies and RPCs use auth.uid() as p_user_id.
create or replace function public.is_conversation_participant(
  p_conversation_id uuid,
  p_user_id uuid default auth.uid()
) returns boolean
language sql stable security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select p_user_id is not null
    and p_user_id = auth.uid()
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = p_conversation_id and cp.user_id = p_user_id
    );
$$;
revoke all on function public.is_conversation_participant(uuid, uuid) from public, anon;
grant execute on function public.is_conversation_participant(uuid, uuid) to authenticated;
