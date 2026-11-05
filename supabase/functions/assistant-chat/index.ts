import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ASSISTANT_ALLOWED_ORIGIN") || "https://usadzoran.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const maxMessageLength = 1200;
const maxHistoryMessages = 12;
const siteMap = [
  { name: "Home", path: "/home", description: "Home feed with posts, suggestions, and trending topics." },
  { name: "Match", path: "/match", description: "Compatibility discovery from completed, discoverable profiles." },
  { name: "Discover", path: "/discover", description: "Entry point for discovery, rooms, and other paths." },
  { name: "Daily", path: "/daily", description: "Daily weather and news briefing." },
  { name: "YouTube", path: "/youtube", description: "Search real YouTube videos and play them in the official player when embedding is allowed." },
  { name: "Rooms", path: "/rooms", description: "Audio room interface; real-time audio is not enabled in the current prototype." },
  { name: "Profile", path: "/profile", description: "Profile, privacy settings, gallery, and social counters." },
  { name: "Messages", path: "/messages", description: "Private conversations and consent-controlled face reveal flow." },
  { name: "VIP", path: "/vip", description: "VIP feature status; streaming, payments, gifts, and payouts require production providers." },
  { name: "Assistant", path: "/assistant", description: "This scoped assistant and the guided discovery questionnaire." },
];
const systemPrompt = `You are IQZodiac Assistant. You may only help with the IQZodiac website and server-supplied search results. You may explain website features, search YouTube videos, and search films, TV titles, actors, directors, and fictional characters. You must not claim to change accounts, grant VIP, send messages, reveal private photos, change payments, access private data, or perform admin actions. Never invent results, people, scores, prices, availability, or features. Answer briefly in the user's language (Arabic or English).`;

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
function detectIntent(message: string) {
  if (/(youtube|يوتيوب|فيديو|فيديوهات|أغنية|اغنية|قناة|video|song|channel)/i.test(message)) return "youtube_search";
  if (/(فيلم|أفلام|افلام|مسلسل|ممثل|ممثلة|شخصية|شخصيات|movie|film|series|actor|actress|character|director)/i.test(message)) return "media_search";
  return "site_help";
}
function cleanQuery(message: string) {
  return message.replace(/(?:ابحث|بحث|أريد|اريد|عن|في|please|search|find|for|on|youtube|يوتيوب|فيديو|فيلم|أفلام|افلام|شخصية|شخصيات)/gi, " ").replace(/\s+/g, " ").trim().slice(0, 160);
}
async function searchYouTube(query: string) {
  const apiKey = Deno.env.get("YOUTUBE_API_KEY");
  if (!apiKey) return { unavailable: true, reason: "youtube_not_configured" };
  const params = new URLSearchParams({ part: "snippet", type: "video", maxResults: "6", q: query, key: apiKey });
  const upstream = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!upstream.ok) return { unavailable: true, reason: "youtube_unavailable" };
  const payload = await upstream.json();
  return { items: (payload.items || []).map((item: any) => ({ type: "video", id: item.id?.videoId || "", title: item.snippet?.title || "", channel: item.snippet?.channelTitle || "", url: item.id?.videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(item.id.videoId)}` : "" })).filter((item: any) => item.id) };
}
async function searchMedia(query: string) {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) return { unavailable: true, reason: "media_not_configured" };
  const params = new URLSearchParams({ api_key: apiKey, query, language: "en-US", include_adult: "false", page: "1" });
  const upstream = await fetch(`https://api.themoviedb.org/3/search/multi?${params}`);
  if (!upstream.ok) return { unavailable: true, reason: "media_unavailable" };
  const payload = await upstream.json();
  return { items: (payload.results || []).slice(0, 8).map((item: any) => ({ type: item.media_type, id: item.id, title: item.title || item.name || "", date: item.release_date || item.first_air_date || "", overview: String(item.overview || "").slice(0, 240) })) };
}
async function callModel(messages: any[]) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;
  const base = (Deno.env.get("OPENAI_API_BASE") || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = Deno.env.get("IQZODIAC_ASSISTANT_MODEL") || "gpt-6-luna";
  const upstream = await fetch(`${base}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages, max_completion_tokens: 700, reasoning: { effort: "low" } }) });
  if (!upstream.ok) return null;
  const payload = await upstream.json();
  return payload.choices?.[0]?.message?.content?.trim() || null;
}
function siteHelpFallback(message: string) {
  const arabic = /[\u0600-\u06ff]/.test(message);
  if (arabic) return "مرحبًا بك في IQZodiac. يمكنك إنشاء حساب جديد للبدء، ثم سيقودك المساعد إلى اكتشاف اهتماماتك وشخصيتك وبرجك. بعد ذلك يمكنك استخدام Home للمنشورات، Match للتوافق، Discover للاستكشاف، Daily للأخبار والطقس، Rooms للغرف الصوتية، Profile لإدارة ملفك وخصوصيتك، وYouTube للبحث عن الفيديوهات. لا أستطيع الوصول إلى بياناتك الخاصة أو تغيير الحسابات والمدفوعات.";
  return "Welcome to IQZodiac. Create an account to begin, then the onboarding assistant will help you explore your interests, personality pattern, and zodiac sign. Home is for posts, Match for compatibility, Discover for exploring paths, Daily for news and weather, Rooms for audio rooms, Profile for your privacy and profile, and YouTube for video search. I cannot access private data or change accounts or payments.";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response(405, { error: { code: "method_not_allowed", message: "Use POST." } });
  let body: any;
  try { body = await req.json(); } catch { return response(400, { error: { code: "invalid_json", message: "The request body is invalid." } }); }
  const guestMode = body.guest === true;
  const message = String(body.message || "").trim();
  if (!message || message.length > maxMessageLength) return response(400, { error: { code: "invalid_message", message: "Message must contain between 1 and 1200 characters." } });
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token && !guestMode) return response(401, { error: { code: "unauthorized", message: "Please sign in before using the assistant." } });
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  let supabase: any = null;
  let authData: any = { user: null };
  if (!guestMode) {
    if (!supabaseUrl || !anonKey) return response(503, { error: { code: "auth_not_configured", message: "Assistant authentication is not configured." } });
    supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const authResult = await supabase.auth.getUser(token);
    authData = authResult.data;
    if (authResult.error || !authData.user) return response(401, { error: { code: "unauthorized", message: "Please sign in before using the assistant." } });
  }
  const history = guestMode ? [] : (Array.isArray(body.history) ? body.history.slice(-maxHistoryMessages).filter((item: any) => ["user", "assistant"].includes(item?.role) && typeof item.content === "string").map((item: any) => ({ role: item.role, content: item.content.slice(0, 1200) })) : []);
  const intent = guestMode ? "site_help" : detectIntent(message);
  const query = cleanQuery(message) || message.slice(0, 160);
  let searchResults: any = null;
  try { if (intent === "youtube_search") searchResults = await searchYouTube(query); if (intent === "media_search") searchResults = await searchMedia(query); } catch { searchResults = { unavailable: true, reason: "search_unavailable" }; }
  const context = JSON.stringify({ intent, query, siteMap, searchResults });
  const answer = await callModel([{ role: "system", content: `${systemPrompt}\n\nServer-authorized context:\n${context}` }, ...history, { role: "user", content: message }]);
  const finalAnswer = answer || (intent === "site_help" ? siteHelpFallback(message) : intent === "youtube_search" && searchResults?.items?.length ? `وجدت ${searchResults.items.length} نتائج في YouTube.` : intent === "media_search" && searchResults?.items?.length ? `وجدت ${searchResults.items.length} نتائج للأفلام أو الشخصيات.` : "المساعد غير متصل حاليًا أو لم يجد نتائج.");
  const conversationId = typeof body.conversationId === "string" && /^[0-9a-f-]{36}$/i.test(body.conversationId) ? body.conversationId : crypto.randomUUID();
  if (!guestMode) {
    const logRows = [
      { user_id: authData.user.id, conversation_id: conversationId, role: "user", content: message, intent, results: [] },
      { user_id: authData.user.id, conversation_id: conversationId, role: "assistant", content: finalAnswer.slice(0, 4000), intent, results: Array.isArray(searchResults?.items) ? searchResults.items : [] },
    ];
    const { error: logError } = await supabase.from("assistant_conversation_logs").insert(logRows);
    if (logError) console.error("assistant log insert failed", logError.message);
  }
  return response(200, { answer: finalAnswer, intent, results: guestMode ? [] : searchResults?.items || [], conversationId: guestMode ? "" : conversationId });
});
