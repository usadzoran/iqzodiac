

## Clad Body API Integration

Reuse the existing `profile-body3d` capture flow, private `iqzodiac-body-private` bucket, `profile_body_models` records, `body-model-access` viewer, and `body-model-delete` cleanup. The official Clad photo contract accepts one photo plus `height_cm`, returns an asynchronous `job_id`, and later returns a base64 GLB mesh, measurements, and opaque params. The existing front photo is the provider input; the remaining private views are retained for the user's private capture set and existing readiness guard.

Add a server-only `body-model-reconstruct` Edge Function. It authenticates the Supabase JWT, reads the front JPEG from private Storage with the service role, reads `CLAD_API_KEY` only from Edge Function environment variables, submits the multipart request to `https://api.clad.you/v1/body/from-photo`, polls only the returned Clad job URL, validates the returned GLB container and size, uploads it to the existing private bucket, stores measurements and provider metadata, and marks the model ready. Failures mark the model failed without exposing provider keys or raw provider responses.

Extend the existing model record additively with source, provider reference, provider params, measurements JSON, and processing error metadata. No existing tables, photos, models, or storage files are deleted. The UI adds a required height field and invokes reconstruction after all private uploads, showing Uploading, Processing, Completed, and Failed states. Existing viewer, visibility rules, and deletion remain in place.

### Project structure

- `profile.html`, `profile-body3d.js`, `profile-body3d-data.js`: existing capture UI and authenticated client calls.
- `body3d-viewer.js`: existing Three.js GLB viewer, reused unchanged.
- `supabase/functions/body-model-reconstruct/index.ts`: authenticated Clad integration and result persistence.
- `supabase/functions/_shared/clad-body-provider.ts`: Clad request, polling, GLB validation, and measurement normalization.
- `supabase/migrations/20261121170000_clad_body_integration.sql`: additive metadata and safe trigger compatibility.

### Design

- Design movement: restrained cyber-luxury product UI.
- Core principles: private by default, explicit consent, truthful processing states, and progressive disclosure of measurements.
- Color philosophy: retain IQZodiac's midnight blue and cyan accents; use cyan for active processing and green only for a confirmed completed model.
- Layout paradigm: keep the existing profile card and add a compact measurement/status panel rather than creating a new section.
- Signature elements: privacy badge, stateful progress label, and a compact measurement grid.
- Interaction philosophy: every provider action is explicit and cancellable through deletion; no success state is shown before a real GLB is stored.
- Animation: subtle status transitions only; respect reduced-motion preferences.
- Typography system: reuse the existing profile typography and card hierarchy.
- Brand essence: a private, measurable body profile for IQZodiac members; precise, discreet, practical.
- Brand voice: clear and honest, e.g. “Your model is processing securely.” and “No model is shown until a real result is stored.”
- Wordmark & logo: reuse existing IQZodiac identity; no new logo.
- Signature brand color: existing cyan accent used for secure processing.

### Official evidence

Clad's official developer page states that the service accepts one photo or eight short questions and exposes GLB meshes plus ISO 8559-1 measurements. The official OpenAPI document defines `POST /v1/body/from-photo` as multipart form data with `photo` and `height_cm`, returning an asynchronous `job_id`; `GET /v1/jobs/{job_id}` returns queued, running, completed, or failed status and the completed mesh, measurements, and opaque params. It also defines bearer authentication and a weekly photo quota. Source: https://clad.you/developers and https://api.clad.you/openapi.json.
