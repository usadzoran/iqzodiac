-- Accept the six capture views requested by the profile flow while retaining
-- support for any legacy eight-view set already stored in this private bucket.
-- No existing body images, model records, or assets are deleted or rewritten.
create or replace function public.guard_profile_body_model_ready()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_angles text[];
begin
  if new.status = 'ready' then
    select array_agg(p.angle order by p.angle)
      into v_angles
      from public.profile_body_scan_photos p
      where p.model_id = new.id;

    if new.face_anonymized is distinct from true
      or (
        v_angles is distinct from array['back','back_left_45','front','front_left_45','left','right']::text[]
        and v_angles is distinct from array['back','back_left_45','back_right_45','front','front_left_45','front_right_45','left','right']::text[]
      )
      or not exists (
        select 1 from public.profile_body_model_assets a
        where a.model_id = new.id and a.user_id = new.user_id
          and a.storage_path = new.user_id::text || '/' || new.id::text || '/model.glb'
          and a.mime_type = 'model/gltf-binary'
      ) then
      raise exception 'body_model_requires_six_or_legacy_eight_views_and_anonymized_glb' using errcode = '23514';
    end if;
  end if;
  if new.visibility = 'show' and (new.status <> 'ready' or new.face_anonymized is distinct from true) then
    raise exception 'body_model_must_be_ready_and_face_anonymized_to_be_public' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_profile_body_model_ready() from public, anon, authenticated;
