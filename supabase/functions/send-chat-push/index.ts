import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const allowedOrigins = new Set(["https://usadzoran.github.io", "http://localhost:3000", "http://127.0.0.1:3000"]);
const jsonHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://usadzoran.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
});
const respond = (status: number, value: unknown, origin: string | null) => new Response(JSON.stringify(value), { status, headers: jsonHeaders(origin) });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response("ok", { headers: jsonHeaders(origin) });
  if (request.method !== "POST") return respond(405, { error: "method_not_allowed" }, origin);
  if (origin && !allowedOrigins.has(origin)) return respond(403, { error: "origin_not_allowed" }, origin);

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "BF2TTPhn_UL9yblxc9A9RsFfGEzqXVcngsJ6aIklXFO5CXgstcP0iSeH_IkyWM6Zh4jGuIXkPGT7iJohU45a_ig";
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@iqzodiac.com";
  if (!token) return respond(401, { error: "unauthorized" }, origin);
  if (!supabaseUrl || !anonKey || !serviceKey || !vapidPublicKey || !vapidPrivateKey) return respond(503, { error: "push_service_not_configured" }, origin);

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: "unauthorized" }, origin);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return respond(400, { error: "invalid_json" }, origin); }
  const conversationId = String(body.conversation_id || "");
  const messageId = String(body.message_id || "");
  if (!uuid.test(conversationId) || !uuid.test(messageId)) return respond(400, { error: "invalid_message_reference" }, origin);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: message, error: messageError } = await admin.from("messages")
    .select("id,conversation_id,sender_id,message_kind,expires_at")
    .eq("id", messageId).eq("conversation_id", conversationId).maybeSingle();
  if (messageError || !message || message.sender_id !== authData.user.id || message.message_kind !== "user") return respond(404, { error: "message_not_found" }, origin);
  if (message.expires_at && new Date(message.expires_at).getTime() <= Date.now()) return respond(200, { sent: 0 }, origin);

  const { data: participants, error: participantsError } = await admin.from("conversation_participants")
    .select("user_id").eq("conversation_id", conversationId);
  if (participantsError || !participants?.some((row) => row.user_id === authData.user.id)) return respond(403, { error: "not_a_conversation_participant" }, origin);
  const recipientIds = participants.map((row) => row.user_id).filter((id) => id !== authData.user.id);
  if (!recipientIds.length) return respond(200, { sent: 0 }, origin);
  const { data: hiddenRows } = await admin.from("message_user_hides").select("user_id").eq("message_id", messageId).in("user_id", recipientIds);
  const hiddenUsers = new Set((hiddenRows || []).map((row) => row.user_id));
  const recipients = recipientIds.filter((id) => !hiddenUsers.has(id));
  if (!recipients.length) return respond(200, { sent: 0 }, origin);

  const { data: subscriptions, error: subscriptionError } = await admin.from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth").in("user_id", recipients);
  if (subscriptionError) return respond(500, { error: "subscriptions_unavailable" }, origin);
  if (!subscriptions?.length) return respond(200, { sent: 0 }, origin);
  const { data: profile } = await admin.from("profiles").select("display_name,handle").eq("user_id", authData.user.id).maybeSingle();
  const senderName = String(profile?.display_name || profile?.handle || "Someone").slice(0, 80);
  const publicUrl = Deno.env.get("PUBLIC_APP_URL") || "https://usadzoran.github.io/iqzodiac/";
  const payload = JSON.stringify({
    title: `${senderName} sent you a message`,
    body: "Open IQZodiac to view it.",
    tag: `iqzodiac-message-${conversationId}`,
    url: `${publicUrl.replace(/\/$/, "")}/messages.html?match=${encodeURIComponent(authData.user.id)}`,
  });

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const results = await Promise.all(subscriptions.map(async (row) => {
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, { TTL: 60 * 60, urgency: "normal" });
      return { id: row.id, ok: true };
    } catch (error) {
      const status = Number((error as { statusCode?: number }).statusCode || 0);
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("id", row.id);
        return { id: row.id, ok: false };
      }
      console.warn("Push delivery failed", status);
      return { id: row.id, ok: false };
    }
  }));
  return respond(200, { sent: results.filter((result) => result.ok).length }, origin);
});
