import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set(["https://usadzoran.github.io", "http://localhost:3000", "http://127.0.0.1:3000"]);
const bucket = "iqzodiac-chat-media";
const maxBytes = 25 * 1024 * 1024;
const maxImageBytes = 12 * 1024 * 1024;
const imageMimes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const audioMimes = new Set(["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm", "audio/aac", "audio/flac", "audio/x-m4a"]);
const fileMimes = new Set(["application/octet-stream", "application/pdf", "text/plain", "text/csv", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]);

function headers(origin: string | null) {
  const accepted = origin && allowedOrigins.has(origin) ? origin : "https://usadzoran.github.io";
  return { "Access-Control-Allow-Origin": accepted, "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
}
function respond(status: number, data: unknown, origin: string | null) {
  return new Response(JSON.stringify(data), { status, headers: headers(origin) });
}
function textPrefix(data: Uint8Array, value: string) {
  const prefix = new TextEncoder().encode(value);
  return data.length >= prefix.length && prefix.every((byte, index) => data[index] === byte);
}
function hasOleHeader(data: Uint8Array) {
  return data.length >= 8 && [0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1].every((byte, index) => data[index] === byte);
}
function hasZipHeader(data: Uint8Array) {
  return data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b && [0x03, 0x05, 0x07].includes(data[2]) && [0x04, 0x06, 0x08].includes(data[3]);
}
function isValidUtf8Text(data: Uint8Array) {
  if (data.includes(0)) return false;
  try { new TextDecoder("utf-8", { fatal: true }).decode(data); return true; } catch { return false; }
}
function matchesMime(data: Uint8Array, mime: string): boolean {
  switch (mime) {
    case "image/jpeg": return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    case "image/png": return data.length >= 8 && [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((byte, index) => data[index] === byte);
    case "image/gif": return textPrefix(data, "GIF87a") || textPrefix(data, "GIF89a");
    case "image/webp": return textPrefix(data, "RIFF") && textPrefix(data.subarray(8), "WEBP");
    case "audio/mpeg": return textPrefix(data, "ID3") || (data.length > 1 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0);
    case "audio/mp4":
    case "audio/x-m4a": return data.length >= 12 && textPrefix(data.subarray(4), "ftyp");
    case "audio/ogg": return textPrefix(data, "OggS");
    case "audio/wav": return textPrefix(data, "RIFF") && textPrefix(data.subarray(8), "WAVE");
    case "audio/webm": return data.length >= 4 && data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3;
    case "audio/aac": return data.length >= 2 && data[0] === 0xff && (data[1] & 0xf6) === 0xf0;
    case "audio/flac": return textPrefix(data, "fLaC");
    case "application/pdf": return textPrefix(data, "%PDF-");
    case "text/plain":
    case "text/csv": return isValidUtf8Text(data);
    case "application/msword":
    case "application/vnd.ms-excel":
    case "application/vnd.ms-powerpoint": return hasOleHeader(data);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation": return hasZipHeader(data);
    case "application/octet-stream": return true;
    default: return false;
  }
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response("ok", { headers: headers(origin) });
  if (request.method !== "POST") return respond(405, { error: "method_not_allowed" }, origin);
  if (origin && !allowedOrigins.has(origin)) return respond(403, { error: "origin_not_allowed" }, origin);

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !supabaseUrl || !anonKey || !serviceKey) return respond(401, { error: "unauthorized" }, origin);

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: "unauthorized" }, origin);
  const userId = authData.user.id;
  let payload: any;
  try { payload = await request.json(); } catch { return respond(400, { error: "invalid_json" }, origin); }

  const conversationId = String(payload.conversation_id || "");
  const objectPath = String(payload.attachment_path || "");
  const attachmentName = String(payload.attachment_name || "").normalize("NFC").replace(/[\\/\u0000-\u001f\u007f]/g, "_").trim().slice(0, 150);
  const attachmentMime = String(payload.attachment_mime || "");
  const attachmentKind = String(payload.attachment_kind || "");
  const messageBody = String(payload.body || "").trim();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(conversationId) || !attachmentName || attachmentName.length > 180 || messageBody.length > 600 || objectPath.split("/").length !== 3 || objectPath.split("/")[0] !== conversationId || objectPath.split("/")[1] !== userId || !objectPath.split("/")[2] || !["image", "audio", "file"].includes(attachmentKind)) return respond(400, { error: "invalid_attachment" }, origin);
  const mimeAllowed = attachmentKind === "image" ? imageMimes.has(attachmentMime) : attachmentKind === "audio" ? audioMimes.has(attachmentMime) : fileMimes.has(attachmentMime);
  if (!mimeAllowed) return respond(415, { error: "unsupported_media_type" }, origin);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: participant } = await admin.from("conversation_participants").select("user_id").eq("conversation_id", conversationId).eq("user_id", userId).maybeSingle();
  if (!participant) return respond(403, { error: "not_a_conversation_participant" }, origin);

  const { data: blob, error: downloadError } = await admin.storage.from(bucket).download(objectPath);
  if (downloadError || !blob) return respond(404, { error: "uploaded_object_not_found" }, origin);
  if (blob.size < 1 || blob.size > maxBytes || (attachmentKind === "image" && blob.size > maxImageBytes)) return respond(413, { error: "attachment_size_invalid" }, origin);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.byteLength !== blob.size || !matchesMime(bytes, attachmentMime)) return respond(415, { error: "file_content_does_not_match_type" }, origin);

  const { data: inserted, error: insertError } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: userId,
    body: messageBody,
    message_kind: "user",
    attachment_path: objectPath,
    attachment_name: attachmentName,
    attachment_mime: attachmentMime,
    attachment_size_bytes: bytes.byteLength,
    attachment_kind: attachmentKind,
  }).select("id").single();
  if (insertError || !inserted) return respond(500, { error: "message_insert_failed" }, origin);
  return respond(201, { message_id: inserted.id }, origin);
});
