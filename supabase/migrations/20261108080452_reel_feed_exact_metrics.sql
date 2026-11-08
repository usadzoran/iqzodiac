-- Exact, privacy-minimal counts for Reels shown in the authenticated feed.
-- The function returns aggregates only; it never exposes liker identities or comment contents.
create or replace function public.get_reel_feed_metrics(p_reel_ids uuid[])
returns table (
  reel_id uuid,
  like_count bigint,
  comment_count bigint,
  liked_by_viewer boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with requested as (
    select distinct requested_ids.id
    from unnest(coalesce(p_reel_ids, array[]::uuid[])) as requested_ids(id)
    where requested_ids.id is not null
    order by requested_ids.id
    limit 50
  )
  select
    r.id,
    (select count(*) from public.reel_likes rl where rl.reel_id = r.id)::bigint,
    (select count(*) from public.reel_comments rc where rc.reel_id = r.id)::bigint,
    exists (
      select 1
      from public.reel_likes rl
      where rl.reel_id = r.id
        and rl.user_id = auth.uid()
    )
  from requested q
  join public.reels r on r.id = q.id
  where auth.uid() is not null;
$$;

revoke all on function public.get_reel_feed_metrics(uuid[]) from public, anon, authenticated;
grant execute on function public.get_reel_feed_metrics(uuid[]) to authenticated;
