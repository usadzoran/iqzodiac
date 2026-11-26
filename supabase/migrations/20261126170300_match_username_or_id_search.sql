-- Extend the existing private Match candidate search with exact username/UUID lookup.
-- The identity predicate is applied before scoring/order/limit; all existing eligibility and privacy checks remain intact.
drop function if exists public.search_compatible_profiles(text, text, smallint, smallint, text);
create function public.search_compatible_profiles(
  p_country text default null,
  p_city text default null,
  p_min_age smallint default null,
  p_max_age smallint default null,
  p_interest text default null,
  p_username_or_id text default null
)
returns table (
  user_id uuid,
  display_name text,
  handle text,
  age smallint,
  country text,
  city text,
  compatibility_score integer,
  common_interests text[],
  personality_matches integer,
  personality_comparisons integer,
  is_online boolean,
  zodiac_sign text,
  personality_element text,
  photos_public boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
with mine as (
  select dp.user_id, dp.personality_element, dp.zodiac_sign, dp.interests, dp.questionnaire_version,
         p.privacy
  from public.discovery_profiles dp
  join public.profiles p on p.user_id = dp.user_id
  where dp.user_id = auth.uid()
    and public.iqz_match_profile_is_eligible(dp.user_id)
), mine_answers as (
  select da.question_id, lower(trim(coalesce(nullif(da.answer_choice, ''), da.answer_text))) as answer_value
  from public.discovery_answers da
  join mine m on da.user_id = m.user_id and da.questionnaire_version = m.questionnaire_version
  where da.question_id ~ '^q(?:[1-9]|1[0-2])$'
), candidates as (
  select dp.user_id, dp.personality_element, dp.zodiac_sign, dp.interests,
         p.display_name, p.handle, p.age, p.country, p.city, p.residence_country, p.residence_city, p.privacy,
         coalesce(pres.last_seen_at >= now() - interval '75 seconds', false) as is_online,
         (p.privacy ->> 'photosPublic') = 'true'
           and exists (select 1 from public.profile_media pm
                       where pm.user_id = dp.user_id
                         and pm.media_type in ('avatar', 'photo')
                         and pm.gallery_section = 'public'
                         and pm.is_public = true) as photos_public
  from public.discovery_profiles dp
  join public.profiles p on p.user_id = dp.user_id
  left join public.match_presence pres on pres.user_id = dp.user_id
  where dp.user_id <> auth.uid()
    and public.iqz_match_profile_is_eligible(dp.user_id)
    and not exists (select 1 from public.match_skips ms where ms.user_id = auth.uid() and ms.candidate_id = dp.user_id)
    and not exists (select 1 from public.match_likes ml where ml.user_id = auth.uid() and ml.candidate_id = dp.user_id)
    and not exists (select 1 from public.matches mt
                    where (mt.user_a = least(auth.uid(), dp.user_id) and mt.user_b = greatest(auth.uid(), dp.user_id)))
    and (nullif(trim(p_country), '') is null
         or ((p.privacy ->> 'personalInfoVisibility') = 'public'
             and lower(coalesce(nullif(p.residence_country, ''), p.country)) = lower(trim(p_country))))
    and (nullif(trim(p_city), '') is null
         or ((p.privacy ->> 'personalInfoVisibility') = 'public'
             and coalesce(nullif(p.residence_city, ''), p.city) ilike '%' || trim(p_city) || '%'))
    and (p_min_age is null or ((p.privacy ->> 'ageVisibility') = 'true' and p.age >= p_min_age))
    and (p_max_age is null or ((p.privacy ->> 'ageVisibility') = 'true' and p.age <= p_max_age))
    and (nullif(trim(p_interest), '') is null
         or exists (select 1 from unnest(dp.interests) as interest(value)
                    where interest.value ilike '%' || trim(p_interest) || '%'))
    and (nullif(trim(p_username_or_id), '') is null or length(trim(p_username_or_id)) <= 80)
    and (nullif(trim(p_username_or_id), '') is null
         or lower(trim(p_username_or_id)) = lower(dp.user_id::text)
         or lower(ltrim(p.handle, '@')) = lower(regexp_replace(trim(p_username_or_id), '^@', '')))
), candidate_answers as (
  select c.user_id, da.question_id,
         lower(trim(coalesce(nullif(da.answer_choice, ''), da.answer_text))) as answer_value
  from candidates c
  join public.discovery_answers da on da.user_id = c.user_id
    and da.questionnaire_version = 'discover-v2'
  where da.question_id ~ '^q(?:[1-9]|1[0-2])$'
), compared as (
  select ca.user_id,
         count(*) filter (where ca.answer_value = ma.answer_value)::integer as personality_matches,
         count(*)::integer as personality_comparisons
  from candidate_answers ca
  join mine_answers ma on ma.question_id = ca.question_id
  group by ca.user_id
), shared as (
  select c.user_id,
         array(select min(trim(candidate_interest.value))
               from unnest(c.interests) as candidate_interest(value)
               where nullif(trim(candidate_interest.value), '') is not null
                 and exists (select 1 from unnest(m.interests) as mine_interest(value)
                             where lower(trim(mine_interest.value)) = lower(trim(candidate_interest.value)))
               group by lower(trim(candidate_interest.value))) as common_interests,
         (select count(distinct lower(trim(candidate_interest.value)))::integer
          from unnest(c.interests) as candidate_interest(value)
          where nullif(trim(candidate_interest.value), '') is not null) as candidate_interest_count,
         (select count(distinct lower(trim(mine_interest.value)))::integer
          from unnest(m.interests) as mine_interest(value)
          where nullif(trim(mine_interest.value), '') is not null) as mine_interest_count,
         (select count(distinct lower(trim(mine_interest.value)))::integer
          from unnest(m.interests) as mine_interest(value)
          where nullif(trim(mine_interest.value), '') is not null
            and not exists (select 1 from unnest(c.interests) as candidate_interest(value)
                            where lower(trim(candidate_interest.value)) = lower(trim(mine_interest.value)))) as unique_mine_interest_count
  from candidates c
  cross join mine m
), scored as (
  select c.*, s.common_interests, x.personality_matches, x.personality_comparisons,
         round(
           45.0 * cardinality(s.common_interests)::numeric
             / nullif(s.candidate_interest_count + s.unique_mine_interest_count, 0)
           + 45.0 * x.personality_matches::numeric / nullif(x.personality_comparisons, 0)
           + case when c.personality_element = m.personality_element then 5 else 0 end
           + case when c.zodiac_sign = m.zodiac_sign then 5 else 0 end
         )::integer as compatibility_score
  from candidates c
  join shared s on s.user_id = c.user_id
  join compared x on x.user_id = c.user_id
  cross join mine m
)
select s.user_id,
       s.display_name,
       s.handle,
       case when (s.privacy ->> 'ageVisibility') = 'true' then s.age else null end as age,
       case when (s.privacy ->> 'personalInfoVisibility') = 'public' then coalesce(nullif(s.residence_country, ''), s.country) else null end as country,
       case when (s.privacy ->> 'personalInfoVisibility') = 'public' then coalesce(nullif(s.residence_city, ''), s.city) else null end as city,
       greatest(0, least(100, s.compatibility_score))::integer,
       s.common_interests,
       s.personality_matches,
       s.personality_comparisons,
       s.is_online,
       s.zodiac_sign,
       s.personality_element,
       s.photos_public
from scored s
order by s.compatibility_score desc, s.user_id
limit 50;
$$;

revoke all on function public.search_compatible_profiles(text, text, smallint, smallint, text, text) from public, anon;
grant execute on function public.search_compatible_profiles(text, text, smallint, smallint, text, text) to authenticated, service_role;
