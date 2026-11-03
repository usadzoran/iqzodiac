-- Allow a signed-in member to remove only their own discovery answers when restarting onboarding.
alter table public.discovery_answers enable row level security;

drop policy if exists "Members delete own discovery answers" on public.discovery_answers;
create policy "Members delete own discovery answers"
on public.discovery_answers
for delete to authenticated
using (auth.uid() = user_id);
