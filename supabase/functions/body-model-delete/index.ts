import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const bucket = "iqzodiac-body-private";
const defaultOrigins = ["https://usadzoran.github.io", "http://localhost:3000", "http://127.0.0.1:3000"];
const configuredOrigins = (Deno.env.get("IQZODIAC_ALLOWED_ORIGINS") || "").split(",").map((value) => value.trim()).filter(Boolean);
const allowedOrigins = new Set(configuredOrigins.length ? configuredOrigins : defaultOrigins);
function headers(origin: string | null) {
  return { "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://usadzoran.github.io", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff" };
}
function reply(status: number, body: unknown, origin: string | null) { return new Response(JSON.stringify(body), { status, headers: headers(origin) }); }

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
  if (!token || !supabaseUrl || !anonKey || !serviceKey) return reply(401, { error: "unauthorized" }, origin);
  const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  if (authError || !authData.user) return reply(401, { error: "unauthorized" }, origin);
  let payload: any;
  try { payload = await request.json(); } catch { return reply(400, { error: "invalid_json" }, origin); }
  const modelId = String(payload.model_id || "");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(modelId)) return reply(400, { error: "invalid_model_id" }, origin);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: model, error: modelError } = await admin.from("profile_body_models").select("id,user_id").eq("id", modelId).maybeSingle();
  if (modelError || !model) return reply(404, { error: "model_not_found" }, origin);
  if (model.user_id !== authData.user.id) return reply(404, { error: "model_not_found" }, origin);

  const prefix = `${model.user_id}/${model.id}`;
  const { data: files, error: listError } = await admin.storage.from(bucket).list(prefix, { limit: 100, sortBy: { column: "name", order: "asc" } });
  if (listError) return reply(502, { error: "storage_list_failed" }, origin);
  const paths = (files || []).filter((file) => file.name && !file.id?.endsWith("/"))
    .map((file) => `${prefix}/${file.name}`);
  if (paths.length) {
    const { error: removeError } = await admin.storage.from(bucket).remove(paths);
    if (removeError) return reply(502, { error: "storage_delete_failed" }, origin);
  }
  const { error: deleteError } = await admin.from("profile_body_models").delete().eq("id", model.id).eq("user_id", model.user_id);
  if (deleteError) return reply(502, { error: "record_delete_failed" }, origin);
  return reply(200, { deleted: true, model_id: model.id, files_deleted: paths.length }, origin);
});
