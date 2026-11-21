import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { reconstructFromPhoto } from "../_shared/clad-body-provider.ts";

const bucket = "iqzodiac-body-private";
const defaultOrigins = ["https://usadzoran.github.io", "https://iqzodiac-yrbo.vercel.app", "http://localhost:3000", "http://127.0.0.1:3000"];
const configuredOrigins = (Deno.env.get("IQZODIAC_ALLOWED_ORIGINS") || "").split(",").map((value) => value.trim()).filter(Boolean);
const allowedOrigins = new Set(configuredOrigins.length ? configuredOrigins : defaultOrigins);

function headers(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://usadzoran.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  };
}
function reply(status: number, body: unknown, origin: string | null) { return new Response(JSON.stringify(body), { status, headers: headers(origin) }); }
function errorCode(error: unknown) { const code = error instanceof Error ? error.message : "processing_failed"; return /^[a-z0-9_]+$/i.test(code) ? code : "processing_failed"; }

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response("ok", { headers: headers(origin) });
  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" }, origin);
  if (origin && !allowedOrigins.has(origin)) return reply(403, { error: "origin_not_allowed" }, origin);

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cladKey = Deno.env.get("CLAD_API_KEY");
  if (!token || !supabaseUrl || !anonKey || !serviceKey) return reply(401, { error: "unauthorized" }, origin);
  if (!cladKey) return reply(503, { error: "clad_not_configured" }, origin);

  const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  if (authError || !authData.user) return reply(401, { error: "unauthorized" }, origin);

  let payload: any;
  try { payload = await request.json(); } catch { return reply(400, { error: "invalid_json" }, origin); }
  const modelId = String(payload.model_id || "");
  const heightCm = Number(payload.height_cm);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(modelId) || !Number.isFinite(heightCm) || heightCm < 140 || heightCm > 220) return reply(422, { error: "invalid_model_or_height" }, origin);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: model, error: modelError } = await admin.from("profile_body_models").select("id,user_id,status,originals_retention").eq("id", modelId).maybeSingle();
  if (modelError || !model || model.user_id !== authData.user.id) return reply(404, { error: "model_not_found" }, origin);
  if (!["awaiting_engine", "failed"].includes(model.status)) return reply(409, { error: "model_not_processable" }, origin);

  const { data: frontPhoto, error: photoError } = await admin.from("profile_body_scan_photos").select("storage_path,mime_type,size_bytes").eq("model_id", model.id).eq("user_id", model.user_id).eq("angle", "front").maybeSingle();
  if (photoError || !frontPhoto || frontPhoto.mime_type !== "image/jpeg") return reply(422, { error: "front_photo_required" }, origin);
  const { data: signed, error: signedError } = await admin.storage.from(bucket).createSignedUrl(frontPhoto.storage_path, 180);
  if (signedError || !signed?.signedUrl) return reply(502, { error: "source_photo_unavailable" }, origin);
  const source = await fetch(signed.signedUrl, { redirect: "error" });
  if (!source.ok || !source.body) return reply(502, { error: "source_photo_unavailable" }, origin);
  const photo = new Blob([await source.arrayBuffer()], { type: "image/jpeg" });
  if (photo.size < 1 || photo.size > 25 * 1024 * 1024) return reply(422, { error: "source_photo_invalid" }, origin);

  await admin.from("profile_body_models").update({ status: "processing", height_cm: heightCm, source_provider: "clad", processing_error: null, updated_at: new Date().toISOString() }).eq("id", model.id).eq("user_id", model.user_id);
  try {
    const result = await reconstructFromPhoto({ apiKey: cladKey, photo, heightCm });
    const modelPath = `${model.user_id}/${model.id}/model.glb`;
    const { error: uploadError } = await admin.storage.from(bucket).upload(modelPath, result.glb, { contentType: "model/gltf-binary", cacheControl: "300", upsert: true });
    if (uploadError) throw new Error("storage_upload_failed");
    const { error: assetError } = await admin.from("profile_body_model_assets").upsert({ model_id: model.id, user_id: model.user_id, storage_path: modelPath, mime_type: "model/gltf-binary", size_bytes: result.glb.byteLength }, { onConflict: "model_id" });
    if (assetError) throw new Error("asset_record_failed");
    const { error: updateError } = await admin.from("profile_body_models").update({ status: "ready", face_anonymized: true, source_provider: "clad", provider_job_id: result.providerModelRef || null, provider_model_ref: result.providerModelRef || null, provider_params: result.params, measurements: result.measurements, processing_error: null, height_cm: heightCm, updated_at: new Date().toISOString() }).eq("id", model.id).eq("user_id", model.user_id);
    if (updateError) throw new Error("model_update_failed");
    if (model.originals_retention === "delete_after_processing") {
      await admin.storage.from(bucket).remove([frontPhoto.storage_path]);
      await admin.from("profile_body_scan_photos").delete().eq("model_id", model.id).eq("angle", "front");
    }
    return reply(200, { status: "completed", model_id: model.id, measurements: result.measurements }, origin);
  } catch (error) {
    const code = errorCode(error);
    await admin.from("profile_body_models").update({ status: "failed", processing_error: code, updated_at: new Date().toISOString() }).eq("id", model.id).eq("user_id", model.user_id);
    return reply(code === "clad_not_configured" ? 503 : 502, { error: code }, origin);
  }
});
