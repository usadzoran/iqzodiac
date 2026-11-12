-- Harden direct table updates: a pinned row cannot be moved or unpinned by a non-owner.
create or replace function public.iqzodiac_validate_pinned_post_comment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_old_owner_id uuid;
  v_new_owner_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.is_pinned is not distinct from old.is_pinned
       and new.post_id is not distinct from old.post_id
       and new.parent_comment_id is not distinct from old.parent_comment_id then
      return new;
    end if;
    if old.is_pinned then
      select p.author_id into v_old_owner_id from public.posts p where p.id = old.post_id;
      if v_old_owner_id is distinct from auth.uid() then
        raise exception 'only_post_owner_may_change_pinned_comments' using errcode = '42501';
      end if;
    end if;
    if not new.is_pinned then return new; end if;
  elsif tg_op = 'INSERT' and not new.is_pinned then
    return new;
  end if;
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  select p.author_id into v_new_owner_id from public.posts p where p.id = new.post_id;
  if v_new_owner_id is distinct from auth.uid() then
    raise exception 'only_post_owner_may_pin_comments' using errcode = '42501';
  end if;
  if new.parent_comment_id is not null then
    raise exception 'only_top_level_comments_may_be_pinned' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists iqzodiac_validate_pinned_post_comment on public.comments;
create trigger iqzodiac_validate_pinned_post_comment
before insert or update on public.comments
for each row execute function public.iqzodiac_validate_pinned_post_comment();

create or replace function public.iqzodiac_validate_pinned_reel_comment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_old_owner_id uuid;
  v_new_owner_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.is_pinned is not distinct from old.is_pinned
       and new.reel_id is not distinct from old.reel_id
       and new.parent_comment_id is not distinct from old.parent_comment_id then
      return new;
    end if;
    if old.is_pinned then
      select r.author_id into v_old_owner_id from public.reels r where r.id = old.reel_id;
      if v_old_owner_id is distinct from auth.uid() then
        raise exception 'only_reel_owner_may_change_pinned_comments' using errcode = '42501';
      end if;
    end if;
    if not new.is_pinned then return new; end if;
  elsif tg_op = 'INSERT' and not new.is_pinned then
    return new;
  end if;
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  select r.author_id into v_new_owner_id from public.reels r where r.id = new.reel_id;
  if v_new_owner_id is distinct from auth.uid() then
    raise exception 'only_reel_owner_may_pin_comments' using errcode = '42501';
  end if;
  if new.parent_comment_id is not null then
    raise exception 'only_top_level_comments_may_be_pinned' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists iqzodiac_validate_pinned_reel_comment on public.reel_comments;
create trigger iqzodiac_validate_pinned_reel_comment
before insert or update on public.reel_comments
for each row execute function public.iqzodiac_validate_pinned_reel_comment();
