-- Time-series aggregates for the authenticated Reel owner only.
-- No raw viewer identities or simulated activity are returned.

create or replace function public.get_my_reel_activity_series(p_days integer default 30)
returns table (
  activity_date date,
  daily_views bigint,
  daily_interactions bigint,
  cumulative_views bigint,
  cumulative_interactions bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with settings as (
    select
      case when p_days in (7, 30, 90) then p_days else 30 end as days,
      (now() at time zone 'UTC')::date as today
  ),
  bounds as (
    select days, today, (today - (days - 1))::date as start_date
    from settings
  ),
  creator_reels as (
    select r.id
    from public.reels r
    where auth.uid() is not null
      and r.author_id = auth.uid()
  ),
  activity_events as (
    select
      (rv.first_viewed_at at time zone 'UTC')::date as event_date,
      count(*)::bigint as view_delta,
      0::bigint as interaction_delta
    from public.reel_views rv
    join creator_reels cr on cr.id = rv.reel_id
    cross join bounds b
    where rv.first_viewed_at >= (b.start_date::timestamp at time zone 'UTC')
      and rv.first_viewed_at < ((b.today + 1)::timestamp at time zone 'UTC')
    group by 1

    union all

    select
      (rl.created_at at time zone 'UTC')::date as event_date,
      0::bigint as view_delta,
      count(*)::bigint as interaction_delta
    from public.reel_likes rl
    join creator_reels cr on cr.id = rl.reel_id
    cross join bounds b
    where rl.created_at >= (b.start_date::timestamp at time zone 'UTC')
      and rl.created_at < ((b.today + 1)::timestamp at time zone 'UTC')
    group by 1

    union all

    select
      (rc.created_at at time zone 'UTC')::date as event_date,
      0::bigint as view_delta,
      count(*)::bigint as interaction_delta
    from public.reel_comments rc
    join creator_reels cr on cr.id = rc.reel_id
    cross join bounds b
    where rc.created_at >= (b.start_date::timestamp at time zone 'UTC')
      and rc.created_at < ((b.today + 1)::timestamp at time zone 'UTC')
    group by 1
  ),
  daily_totals as (
    select
      event_date,
      sum(view_delta)::bigint as daily_views,
      sum(interaction_delta)::bigint as daily_interactions
    from activity_events
    group by event_date
  ),
  calendar as (
    select (b.start_date + offsets.day_offset)::date as activity_date
    from bounds b
    cross join lateral generate_series(0, b.days - 1) as offsets(day_offset)
  ),
  filled as (
    select
      c.activity_date,
      coalesce(d.daily_views, 0)::bigint as daily_views,
      coalesce(d.daily_interactions, 0)::bigint as daily_interactions
    from calendar c
    left join daily_totals d on d.event_date = c.activity_date
  )
  select
    f.activity_date,
    f.daily_views,
    f.daily_interactions,
    sum(f.daily_views) over (order by f.activity_date)::bigint as cumulative_views,
    sum(f.daily_interactions) over (order by f.activity_date)::bigint as cumulative_interactions
  from filled f
  order by f.activity_date;
$$;

revoke all on function public.get_my_reel_activity_series(integer) from public, anon;
grant execute on function public.get_my_reel_activity_series(integer) to authenticated;
