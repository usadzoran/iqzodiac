-- Keep client-facing body-model RPCs as invokers so RLS and column privileges
-- apply to every operation. Only owners may update visibility/retention fields.
revoke all on function public.get_my_profile_body_models() from public, anon;
alter function public.get_my_profile_body_models() security invoker;
grant execute on function public.get_my_profile_body_models() to authenticated;
grant select (originals_retention) on public.profile_body_models to authenticated;

revoke all on function public.set_profile_body_visibility(uuid, text) from public, anon;
alter function public.set_profile_body_visibility(uuid, text) security invoker;
grant execute on function public.set_profile_body_visibility(uuid, text) to authenticated;

revoke all on function public.set_profile_body_retention(uuid, text) from public, anon;
alter function public.set_profile_body_retention(uuid, text) security invoker;
grant execute on function public.set_profile_body_retention(uuid, text) to authenticated;
grant update (visibility, originals_retention, updated_at) on public.profile_body_models to authenticated;
drop policy if exists profile_body_models_owner_update on public.profile_body_models;
create policy profile_body_models_owner_update on public.profile_body_models
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- This table is service-role-only. An explicit denying policy documents that
-- intent and satisfies RLS tooling without granting client table privileges.
drop policy if exists profile_body_assets_no_client_access on public.profile_body_model_assets;
create policy profile_body_assets_no_client_access on public.profile_body_model_assets
  for all to anon, authenticated
  using (false)
  with check (false);

-- The trigger alone needs to inspect the service-only GLB asset table; it is
-- not executable through PostgREST and exposes only a boolean integrity check.
revoke all on function public.guard_profile_body_model_ready() from public, anon, authenticated;
alter function public.guard_profile_body_model_ready() security definer;
