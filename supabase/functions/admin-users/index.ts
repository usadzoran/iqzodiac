import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const defaultOrigins = ["https://usadzoran.github.io", "http://localhost:3000", "http://127.0.0.1:3000"];
const configuredOrigins = (Deno.env.get("IQZODIAC_ALLOWED_ORIGINS") || "").split(",").map((value) => value.trim()).filter(Boolean);
const allowedOrigins = new Set(configuredOrigins.length ? configuredOrigins : defaultOrigins);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const profileColumns = "user_id,first_name,last_name,age,phone,display_name,handle,privacy,created_at,updated_at,country,city,preferred_language,birth_country,birth_city,residence_country,residence_city";

function headers(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://usadzoran.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store, private",
    "Pragma": "no-cache",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  };
}
function reply(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}
function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response("ok", { headers: headers(origin) });
  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" }, origin);
  if (origin && !allowedOrigins.has(origin)) return reply(403, { error: "origin_not_allowed" }, origin);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 16_384) return reply(413, { error: "request_too_large" }, origin);

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !supabaseUrl || !anonKey || !serviceKey) return reply(401, { error: "unauthorized" }, origin);

  const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  if (authError || !authData.user) return reply(401, { error: "unauthorized" }, origin);
  const actorId = authData.user.id;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: owner, error: ownerError } = await admin.from("salon_owner_roles")
    .select("user_id").eq("user_id", actorId).eq("role", "owner").maybeSingle();
  if (ownerError) return reply(503, { error: "owner_authorization_unavailable" }, origin);
  if (!owner) return reply(403, { error: "owner_required" }, origin);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid");
  } catch {
    return reply(400, { error: "invalid_json" }, origin);
  }
  const action = cleanText(body.action, 40);

  const isOwnerTarget = async (userId: string) => {
    const { data, error } = await admin.from("salon_owner_roles").select("user_id")
      .eq("user_id", userId).eq("role", "owner").maybeSingle();
    if (error) throw new Error("owner_lookup_failed");
    return Boolean(data);
  };
  const audit = async (actionCode: string, targetId: string | null, metadata: Record<string, unknown> = {}) => {
    const { error } = await admin.from("vip_admin_audit_log").insert({
      actor_user_id: actorId,
      action_code: actionCode,
      entity_type: "user_account",
      entity_id: targetId,
      metadata: { ...metadata, source: "admin_users_edge_function" },
    });
    if (error) console.error("admin_users_audit_write_failed", actionCode, error.code || "unknown");
  };

  try {
    if (action === "list") {
      const page = Math.max(1, Math.min(10_000, Math.trunc(Number(body.page) || 1)));
      const perPage = Math.max(1, Math.min(100, Math.trunc(Number(body.per_page) || 50)));
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) return reply(502, { error: "user_list_unavailable" }, origin);
      const users = data.users || [];
      const ids = users.map((user) => user.id);
      const { data: profiles, error: profilesError } = ids.length
        ? await admin.from("profiles").select(profileColumns).in("user_id", ids)
        : { data: [], error: null };
      if (profilesError) return reply(502, { error: "profile_list_unavailable" }, origin);
      const profileById = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
      const limitedUsers = users.map((user) => ({
        id: user.id,
        email: user.email || "",
        auth_phone: user.phone || "",
        created_at: user.created_at || null,
        last_sign_in_at: user.last_sign_in_at || null,
        email_confirmed_at: user.email_confirmed_at || null,
        phone_confirmed_at: user.phone_confirmed_at || null,
        banned_until: user.banned_until || null,
        profile: profileById.get(user.id) || null,
      }));
      return reply(200, { ok: true, users: limitedUsers, page, per_page: perPage, has_next: users.length === perPage }, origin);
    }

    if (action === "invite") {
      const email = cleanText(body.email, 254).toLowerCase();
      const firstName = cleanText(body.first_name, 80);
      const lastName = cleanText(body.last_name, 80);
      if (!emailPattern.test(email)) return reply(400, { error: "invalid_email" }, origin);
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { first_name: firstName, last_name: lastName },
      });
      if (error || !data.user) return reply(502, { error: "invite_failed" }, origin);
      await audit("invite_user", data.user.id);
      return reply(200, { ok: true, user_id: data.user.id, invite_sent: true }, origin);
    }

    if (action === "reset_password") {
      const userId = cleanText(body.user_id, 36);
      if (!uuid.test(userId)) return reply(400, { error: "invalid_user_id" }, origin);
      if (await isOwnerTarget(userId)) return reply(403, { error: "owner_account_protected" }, origin);
      const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
      if (targetError || !target.user?.email) return reply(404, { error: "user_not_found" }, origin);
      const configuredSiteUrl = Deno.env.get("PUBLIC_APP_URL") || "https://usadzoran.github.io/iqzodiac/";
      const siteUrl = configuredSiteUrl.endsWith("/") ? configuredSiteUrl : `${configuredSiteUrl}/`;
      const { error } = await auth.auth.resetPasswordForEmail(target.user.email, { redirectTo: new URL("account-password-recovery.html", siteUrl).toString() });
      if (error) return reply(502, { error: "password_reset_email_failed" }, origin);
      await audit("request_password_reset", userId);
      return reply(200, { ok: true, email_sent: true }, origin);
    }

    if (action === "update") {
      const userId = cleanText(body.user_id, 36);
      if (!uuid.test(userId)) return reply(400, { error: "invalid_user_id" }, origin);
      if (await isOwnerTarget(userId)) return reply(403, { error: "owner_account_protected" }, origin);
      const profileInput = body.profile;
      if (!profileInput || typeof profileInput !== "object" || Array.isArray(profileInput)) return reply(400, { error: "invalid_profile" }, origin);
      const raw = profileInput as Record<string, unknown>;
      const displayName = cleanText(raw.display_name, 80);
      const handle = cleanText(raw.handle, 24).replace(/^@/, "");
      const language = cleanText(raw.preferred_language, 5).toLowerCase();
      const ageValue = raw.age === "" || raw.age === null || raw.age === undefined ? null : Number(raw.age);
      if (!displayName || !/^[A-Za-z0-9._-]{1,24}$/.test(handle) || !["en", "ar"].includes(language)
        || (ageValue !== null && (!Number.isInteger(ageValue) || ageValue < 18 || ageValue > 120))) {
        return reply(400, { error: "invalid_profile_fields" }, origin);
      }
      const profilePatch = {
        first_name: cleanText(raw.first_name, 80),
        last_name: cleanText(raw.last_name, 80),
        age: ageValue,
        phone: cleanText(raw.phone, 40),
        display_name: displayName,
        handle: `@${handle}`,
        country: cleanText(raw.country, 100),
        city: cleanText(raw.city, 100),
        preferred_language: language,
        birth_country: cleanText(raw.birth_country, 100),
        birth_city: cleanText(raw.birth_city, 100),
        residence_country: cleanText(raw.residence_country, 100),
        residence_city: cleanText(raw.residence_city, 100),
      };
      const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
      if (targetError || !target.user) return reply(404, { error: "user_not_found" }, origin);
      const newEmail = cleanText(body.email, 254).toLowerCase();
      if (newEmail && newEmail !== (target.user.email || "").toLowerCase()) {
        if (!emailPattern.test(newEmail)) return reply(400, { error: "invalid_email" }, origin);
        const { error } = await admin.auth.admin.updateUserById(userId, { email: newEmail });
        if (error) return reply(502, { error: "email_update_failed" }, origin);
      }
      const { data: profileRow, error: profileError } = await admin.from("profiles").update(profilePatch)
        .eq("user_id", userId).select("user_id").maybeSingle();
      if (profileError) return reply(502, { error: "profile_update_failed" }, origin);
      if (!profileRow) return reply(404, { error: "profile_not_found" }, origin);
      await audit("update_user_profile", userId, { fields: Object.keys(profilePatch) });
      return reply(200, { ok: true }, origin);
    }

    if (action === "set_ban") {
      const userId = cleanText(body.user_id, 36);
      const banned = body.banned === true;
      if (!uuid.test(userId)) return reply(400, { error: "invalid_user_id" }, origin);
      if (userId === actorId || await isOwnerTarget(userId)) return reply(403, { error: "owner_account_protected" }, origin);
      const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: banned ? "876000h" : "none" });
      if (error) return reply(502, { error: "account_status_update_failed" }, origin);
      await audit(banned ? "suspend_user" : "restore_user", userId);
      return reply(200, { ok: true, banned }, origin);
    }

    if (action === "delete") {
      const userId = cleanText(body.user_id, 36);
      const confirmationEmail = cleanText(body.confirm_email, 254).toLowerCase();
      if (!uuid.test(userId)) return reply(400, { error: "invalid_user_id" }, origin);
      if (userId === actorId || await isOwnerTarget(userId)) return reply(403, { error: "owner_account_protected" }, origin);
      const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
      if (targetError || !target.user?.email) return reply(404, { error: "user_not_found" }, origin);
      if (confirmationEmail !== target.user.email.toLowerCase()) return reply(400, { error: "email_confirmation_mismatch" }, origin);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return reply(502, { error: "account_delete_failed" }, origin);
      await audit("delete_user", userId);
      return reply(200, { ok: true, deleted: true }, origin);
    }

    return reply(400, { error: "unknown_action" }, origin);
  } catch (error) {
    console.error("admin_users_request_failed", error instanceof Error ? error.message : "unknown");
    return reply(500, { error: "admin_users_operation_failed" }, origin);
  }
});
