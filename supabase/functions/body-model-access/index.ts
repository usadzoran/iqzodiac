import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const bucket = "iqzodiac-body-private";
const defaultOrigins = ["https://usadzoran.github.io", "http://localhost:3000", "http://127.0.0.1:3000"];
const configuredOrigins = (Deno.env.get("IQZODIAC_ALLOWED_ORIGINS") || "").split(",").map((value) => value.trim()).filter(Boolean);
const allowedOrigins = new Set(configuredOrigins.length ? configuredOrigins : defaultOrigins);

function responseHeaders(origin: string | null) {
  const originValue = origin && allowedOrigins.has(origin) ? origin : "https://usadzoran.github.io";
  return {
    "Access-Control-Allow-Origin": originValue,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Expose-Headers": "content-length, content-range, accept-ranges, content-disposition",
    "Vary": "Origin",
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
}
function json(status: number, payload: unknown, origin: string | null) {
  return new Response(JSON.stringify(payload), { status, headers: { ...responseHeaders(origin), "Content-Type": "application/json; charset=utf-8" } });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response("ok", { headers: responseHeaders(origin) });
  if (request.method !== "GET" && request.method !== "HEAD") return json(405, { error: "method_not_allowed" }, origin);
  if (origin && !allowedOrigins.has(origin)) return json(403, { error: "origin_not_allowed" }, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json(503, { error: "storage_access_not_configured" }, origin);

  let viewerId: string | null = null;
  const authorization = request.headers.get("Authorization") || "";
  if (authorization) {
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token || !anonKey) return json(401, { error: "unauthorized" }, origin);
    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data.user) return json(401, { error: "unauthorized" }, origin);
    viewerId = data.user.id;
  }

  const modelId = new URL(request.url).searchParams.get("model_id") || "";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(modelId)) return json(400, { error: "invalid_model_id" }, origin);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: model, error: modelError } = await admin.from("profile_body_models")
    .select("id,user_id,status,visibility,face_anonymized")
    .eq("id", modelId).maybeSingle();
  if (modelError || !model || model.status !== "ready" || model.face_anonymized !== true) {
    return json(404, { error: "model_not_available" }, origin);
  }
  const owner = viewerId !== null && viewerId === model.user_id;
  if (!owner && model.visibility !== "show") return json(404, { error: "model_not_available" }, origin);

  const { data: asset, error: assetError } = await admin.from("profile_body_model_assets")
    .select("storage_path,mime_type,size_bytes")
    .eq("model_id", model.id).eq("user_id", model.user_id).maybeSingle();
  const expectedPath = `${model.user_id}/${model.id}/model.glb`;
  if (assetError || !asset || asset.storage_path !== expectedPath || asset.mime_type !== "model/gltf-binary" || asset.size_bytes > 52428800) {
    return json(404, { error: "model_asset_unavailable" }, origin);
  }

  const { data: signed, error: signError } = await admin.storage.from(bucket).createSignedUrl(asset.storage_path, 60);
  if (signError || !signed?.signedUrl) return json(502, { error: "model_stream_unavailable" }, origin);
  const range = request.headers.get("range");
  const upstream = await fetch(signed.signedUrl, { method: request.method, headers: range ? { range } : undefined });
  if (!upstream.ok && upstream.status !== 206) return json(502, { error: "model_stream_unavailable" }, origin);

  const headers = new Headers(responseHeaders(origin));
  headers.set("Content-Type", "model/gltf-binary");
  headers.set("Content-Disposition", new URL(request.url).searchParams.get("download") === "1"
    ? 'attachment; filename="iqzodiac-body-model.glb"'
    : 'inline; filename="iqzodiac-body-model.glb"');
  for (const name of ["content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(request.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
});
