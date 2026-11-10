-- Support one-level replies on Reel comments while keeping replies on the
-- same Reel. If a parent is removed, preserve replies as standalone comments.
alter table public.reel_comments
  add column if not exists parent_comment_id uuid;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reel_comments'::regclass
      and conname = 'reel_comments_parent_comment_id_fkey'
  ) then
    alter table public.reel_comments
      add constraint reel_comments_parent_comment_id_fkey
      foreign key (parent_comment_id)
      references public.reel_comments(id)
      on delete set null;
  end if;
end $$;

create index if not exists reel_comments_parent_idx
  on public.reel_comments(parent_comment_id, created_at asc)
  where parent_comment_id is not null;

create or replace function public.iqzodiac_validate_reel_comment_parent()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_parent_reel_id uuid;
  v_parent_parent_id uuid;
begin
  if new.parent_comment_id is null then return new; end if;

  select c.reel_id, c.parent_comment_id
    into v_parent_reel_id, v_parent_parent_id
    from public.reel_comments c
    where c.id = new.parent_comment_id;

  if not found then
    raise exception 'reel_comment_parent_not_found' using errcode = '23503';
  end if;
  if v_parent_reel_id <> new.reel_id then
    raise exception 'reel_comment_parent_must_share_reel' using errcode = '23514';
  end if;
  if v_parent_parent_id is not null then
    raise exception 'nested_reel_comment_replies_not_allowed' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.iqzodiac_validate_reel_comment_parent() from public, anon, authenticated;

drop trigger if exists iqzodiac_validate_reel_comment_parent on public.reel_comments;
create trigger iqzodiac_validate_reel_comment_parent
before insert or update of reel_id, parent_comment_id on public.reel_comments
for each row execute function public.iqzodiac_validate_reel_comment_parent();
