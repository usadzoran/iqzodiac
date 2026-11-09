-- Reassert that every authenticated member can delete their own comment,
-- including comments written on another member's post.
grant delete on table public.comments to authenticated;
drop policy if exists "Members delete own comments" on public.comments;
create policy "Members delete own comments" on public.comments
  for delete to authenticated
  using (auth.uid() = author_id);
