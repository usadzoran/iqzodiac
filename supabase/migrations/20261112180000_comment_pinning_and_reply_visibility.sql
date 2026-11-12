-- Persist one pinned top-level comment per Post or Reel.
alter table public.comments
  add column if not exists is_pinned boolean not null default false,
  add constraint comments_pinned_root_only check (not is_pinned or parent_comment_id is null);

alter table public.reel_comments
  add column if not exists is_pinned boolean not null default false,
  add constraint reel_comments_pinned_root_only check (not is_pinned or parent_comment_id is null);

create unique index comments_one_pinned_per_post_idx
  on public.comments(post_id)
  where is_pinned;

create unique index reel_comments_one_pinned_per_reel_idx
  on public.reel_comments(reel_id)
  where is_pinned;

-- Direct table writes must not let a commenter pin or unpin another owner's comment.
create or replace function public.iqzodiac_validate_pinned_post_comment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_owner_id uuid;
begin
  if tg_op = 'UPDATE' and new.is_pinned is not distinct from old.is_pinned then return new; end if;
  if tg_op = 'INSERT' and not new.is_pinned then return new; end if;
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  select p.author_id into v_owner_id from public.posts p where p.id = new.post_id;
  if v_owner_id is distinct from auth.uid() then
    raise exception 'only_post_owner_may_pin_comments' using errcode = '42501';
  end if;
  if new.is_pinned and new.parent_comment_id is not null then
    raise exception 'only_top_level_comments_may_be_pinned' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.iqzodiac_validate_pinned_post_comment() from public, anon, authenticated;

drop trigger if exists iqzodiac_validate_pinned_post_comment on public.comments;
create trigger iqzodiac_validate_pinned_post_comment
before insert or update of is_pinned on public.comments
for each row execute function public.iqzodiac_validate_pinned_post_comment();

create or replace function public.iqzodiac_validate_pinned_reel_comment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_owner_id uuid;
begin
  if tg_op = 'UPDATE' and new.is_pinned is not distinct from old.is_pinned then return new; end if;
  if tg_op = 'INSERT' and not new.is_pinned then return new; end if;
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  select r.author_id into v_owner_id from public.reels r where r.id = new.reel_id;
  if v_owner_id is distinct from auth.uid() then
    raise exception 'only_reel_owner_may_pin_comments' using errcode = '42501';
  end if;
  if new.is_pinned and new.parent_comment_id is not null then
    raise exception 'only_top_level_comments_may_be_pinned' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.iqzodiac_validate_pinned_reel_comment() from public, anon, authenticated;

drop trigger if exists iqzodiac_validate_pinned_reel_comment on public.reel_comments;
create trigger iqzodiac_validate_pinned_reel_comment
before insert or update of is_pinned on public.reel_comments
for each row execute function public.iqzodiac_validate_pinned_reel_comment();

-- Serialize pin changes per content item, enforce ownership, and allow NULL to unpin.
create or replace function public.set_post_pinned_comment(p_post_id uuid, p_comment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  select p.author_id into v_owner_id from public.posts p where p.id = p_post_id for update;
  if not found then raise exception 'post_not_found' using errcode = 'P0002'; end if;
  if v_owner_id is distinct from auth.uid() then
    raise exception 'only_post_owner_may_pin_comments' using errcode = '42501';
  end if;
  if p_comment_id is not null then
    perform 1 from public.comments c
      where c.id = p_comment_id and c.post_id = p_post_id and c.parent_comment_id is null
      for update;
    if not found then raise exception 'top_level_comment_not_found_for_post' using errcode = 'P0002'; end if;
  end if;
  update public.comments set is_pinned = false where post_id = p_post_id and is_pinned;
  if p_comment_id is not null then
    update public.comments set is_pinned = true where id = p_comment_id;
  end if;
  return true;
end;
$$;
revoke all on function public.set_post_pinned_comment(uuid, uuid) from public, anon;
grant execute on function public.set_post_pinned_comment(uuid, uuid) to authenticated;

create or replace function public.set_reel_pinned_comment(p_reel_id uuid, p_comment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  select r.author_id into v_owner_id from public.reels r where r.id = p_reel_id for update;
  if not found then raise exception 'reel_not_found' using errcode = 'P0002'; end if;
  if v_owner_id is distinct from auth.uid() then
    raise exception 'only_reel_owner_may_pin_comments' using errcode = '42501';
  end if;
  if p_comment_id is not null then
    perform 1 from public.reel_comments c
      where c.id = p_comment_id and c.reel_id = p_reel_id and c.parent_comment_id is null
      for update;
    if not found then raise exception 'top_level_comment_not_found_for_reel' using errcode = 'P0002'; end if;
  end if;
  update public.reel_comments set is_pinned = false where reel_id = p_reel_id and is_pinned;
  if p_comment_id is not null then
    update public.reel_comments set is_pinned = true where id = p_comment_id;
  end if;
  return true;
end;
$$;
revoke all on function public.set_reel_pinned_comment(uuid, uuid) from public, anon;
grant execute on function public.set_reel_pinned_comment(uuid, uuid) to authenticated;

-- Keep replies visible after reload even if their author has not created a profile row.
drop function if exists public.get_post_comments(uuid[]);
create function public.get_post_comments(p_post_ids uuid[])
returns table(
  post_id uuid,
  comment_id uuid,
  author_id uuid,
  display_name text,
  handle text,
  body text,
  created_at timestamptz,
  parent_comment_id uuid,
  media_type text,
  media_path text,
  media_mime text,
  media_size_bytes bigint,
  is_pinned boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select c.post_id, c.id, c.author_id,
    coalesce(nullif(btrim(p.display_name), ''), 'Orbit Member'),
    coalesce(nullif(btrim(p.handle), ''), '@member'),
    c.body, c.created_at, c.parent_comment_id,
    c.media_type, c.media_path, c.media_mime, c.media_size_bytes, c.is_pinned
  from public.comments c
  left join public.profiles p on p.user_id = c.author_id
  where auth.uid() is not null and c.post_id = any(p_post_ids)
  order by c.created_at asc;
$$;
revoke all on function public.get_post_comments(uuid[]) from public, anon;
grant execute on function public.get_post_comments(uuid[]) to authenticated;
