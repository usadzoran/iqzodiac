-- Additive Clad integration metadata. Existing body records and files remain untouched.
alter table public.profile_body_models
  add column if not exists source_provider text,
  add column if not exists provider_job_id text,
  add column if not exists provider_model_ref text,
  add column if not exists provider_params text,
  add column if not exists measurements jsonb not null default '{}'::jsonb,
  add column if not exists processing_error text,
  add column if not exists height_cm numeric;

alter table public.profile_body_models
  drop constraint if exists profile_body_models_height_cm_check;
alter table public.profile_body_models
  add constraint profile_body_models_height_cm_check
  check (height_cm is null or height_cm between 140 and 220);

create index if not exists profile_body_models_provider_job_idx
  on public.profile_body_models (provider_job_id)
  where provider_job_id is not null;

-- Permit the authenticated owner to read the new metadata through the existing table policy.
grant select (source_provider, provider_job_id, provider_model_ref, provider_params, measurements, processing_error, height_cm)
  on public.profile_body_models to authenticated;
