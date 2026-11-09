-- Allow members to edit only the comments they authored.
grant update on table public.comments to authenticated;
drop policy if exists "Members update own comments" on public.comments;
create policy "Members update own comments" on public.comments
  for update to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);
