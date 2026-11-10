-- Let a comment author edit only the comment body. Ownership and reel linkage
-- remain immutable to authenticated clients.
grant update (body) on table public.reel_comments to authenticated;

drop policy if exists reel_comments_owner_update on public.reel_comments;
create policy reel_comments_owner_update on public.reel_comments
  for update to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);
