

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


## Discover Vault

Reuse the existing Discover page and navigation rather than creating a second Discover route. Add a compact Vault card with private image, video, and audio upload controls. Store only owner-scoped metadata in `vault_items` and originals in the non-public `iqzodiac-vault-private` bucket, with RLS and Storage policies requiring the authenticated user's folder.

The browser uses WebAuthn platform user verification before revealing signed media URLs. On supported phones this invokes Face ID, fingerprint, or the operating-system device lock, which may be a PIN or pattern. The web platform does not expose a direct API for a site's own custom phone pattern. The server-side privacy boundary remains Supabase Auth, RLS, and private Storage; the biometric prompt is an additional local unlock gate.


## Site Ads Manager — simplified publishing
Reuse the private Ads Studio, existing `site_ads` table and RLS, and sandboxed `ad-runtime.js`; do not create ad records for testing. Restore the studio to English with the IQZodiac midnight/cyan visual style and a short publishing path: choose one page (or all supported content/member pages) and one placement from clear dependent dropdowns, then publish or save a draft. Persist the selected page/placement through the existing `sections`, `placements`, and legacy `placement` columns, using only values accepted by the database constraints; add an additive migration for the supported page keys. Install header, main-content, and footer slots on supported content/member pages while retaining Home's post-feed and Reels' between-video positions. Keep drafts and out-of-window ads hidden, confirm persistence using a returned database row before clearing the form, distinguish a persisted ad from a failed list/analytics refresh, and refresh already-open pages on focus and periodically only while visible. Do not publish or insert synthetic production ads during validation.
