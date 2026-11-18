import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const configuredOrigin = Deno.env.get("ASSISTANT_ALLOWED_ORIGIN") || "https://usadzoran.github.io";
const maxMessageLength = 1200;
const maxHistoryMessages = 12;
const maxRequestsPerWindow = 20;
const rateWindowMs = 5 * 60 * 1000;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

const siteMap = [
  { name: "Home", path: "/home", description: "Home feed with posts, suggestions, and trending topics." },
  { name: "Match", path: "/match", description: "Zodiac and compatibility discovery from completed, discoverable profiles." },
  { name: "Discover", path: "/discover", description: "Discovery entry point, recommendations, news and platform paths." },
  { name: "Daily", path: "/daily", description: "Daily weather and news briefing." },
  { name: "Profile", path: "/profile", description: "Profile, privacy, gallery, social counters and account settings." },
  { name: "Messages", path: "/messages", description: "Private conversations, temporary messages and consent-controlled media." },
  { name: "Marketplace", path: "/marketplace", description: "Product listings, buying, selling and seller management." },
  { name: "Reels", path: "/reel", description: "Short-form video browsing, likes, saves and comments." },
  { name: "Rooms", path: "/rooms", description: "Audio rooms and live-broadcast interface; access depends on the current project status and roles." },
  { name: "VIP", path: "/vip", description: "VIP feature status and subscription information." },
  { name: "Wallet", path: "/wallet", description: "Coins, wallet and virtual-gift information; never invent balances or prices." },
  { name: "Gift Store", path: "/gift-store", description: "Virtual gifts catalog and related purchase flow." },
  { name: "YouTube", path: "/youtube", description: "Search real YouTube videos and play them in the official player when embedding is allowed." },
  { name: "Assistant", path: "/assistant", description: "This authenticated site-help assistant and guided discovery questionnaire." },
];

const systemPrompt = `You are the official IQZodiac website assistant. Answer only about the actual IQZodiac platform and the interface described in the authorized context below. Use the user's language automatically; support Arabic, English, French, Spanish, Portuguese, and German. For Arabic, write naturally and keep the answer suitable for an RTL interface. Give clear numbered steps when explaining navigation. Be honest when a feature is unavailable or marked as prototype/provider-dependent. Never invent features, prices, balances, earnings, subscription status, users, search results, or permissions. Never reveal private user data or internal secrets. Never claim to change accounts, grant VIP, send messages, reveal private photos, change payments, or perform admin actions. Do not answer unrelated general, medical, legal, financial, political, or coding questions. When the question is outside IQZodiac, briefly explain that you can only help with the IQZodiac website and invite a site question. Keep answers concise but useful.`;

function headers(req: Request) {
  const origin = req.headers.get("Origin") || configuredOrigin;
  const allowed = origin === configuredOrigin ? origin : configuredOrigin;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function response(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers(req), "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

function detectIntent(message: string) {
  if (/(youtube|يوتيوب|فيديو|فيديوهات|أغنية|اغنية|قناة|video|song|channel)/i.test(message)) return "youtube_search";
  if (/(فيلم|أفلام|افلام|مسلسل|ممثل|ممثلة|شخصية|شخصيات|movie|film|series|actor|actress|character|director|película|film|filme)/i.test(message)) return "media_search";
  return "site_help";
}

function cleanQuery(message: string) {
  return message.replace(/(?:ابحث|بحث|أريد|اريد|عن|في|please|search|find|for|on|youtube|يوتيوب|فيديو|فيلم|أفلام|افلام|شخصية|شخصيات)/gi, " ").replace(/\s+/g, " ").trim().slice(0, 160);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("upstream_timeout")), timeoutMs); });
  try { return await Promise.race([promise, timeout]); } finally { if (timer) clearTimeout(timer); }
}

async function searchYouTube(query: string) {
  const apiKey = Deno.env.get("YOUTUBE_API_KEY");
  if (!apiKey) return { unavailable: true, reason: "youtube_not_configured" };
  const params = new URLSearchParams({ part: "snippet", type: "video", maxResults: "6", q: query, key: apiKey });
  const upstream = await withTimeout(fetch(`https://www.googleapis.com/youtube/v3/search?${params}`), 8000);
  if (!upstream.ok) return { unavailable: true, reason: "youtube_unavailable" };
  const payload = await upstream.json();
  return { items: (payload.items || []).map((item: any) => ({ type: "video", id: item.id?.videoId || "", title: item.snippet?.title || "", channel: item.snippet?.channelTitle || "", url: item.id?.videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(item.id.videoId)}` : "" })).filter((item: any) => item.id) };
}

async function searchMedia(query: string) {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) return { unavailable: true, reason: "media_not_configured" };
  const params = new URLSearchParams({ api_key: apiKey, query, language: "en-US", include_adult: "false", page: "1" });
  const upstream = await withTimeout(fetch(`https://api.themoviedb.org/3/search/multi?${params}`), 8000);
  if (!upstream.ok) return { unavailable: true, reason: "media_unavailable" };
  const payload = await upstream.json();
  return { items: (payload.results || []).slice(0, 8).map((item: any) => ({ type: item.media_type, id: item.id, title: item.title || item.name || "", date: item.release_date || item.first_air_date || "", overview: String(item.overview || "").slice(0, 240) })) };
}

async function callModel(messages: any[]) {
  const apiKey = Deno.env.get("AI_API_KEY");
  if (!apiKey) throw new Error("ai_not_configured");
  const base = (Deno.env.get("GEMINI_API_BASE") || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  const model = Deno.env.get("GEMINI_MODEL") || Deno.env.get("IQZODIAC_ASSISTANT_MODEL") || "gemini-flash-latest";
  const system = messages.find((message) => message.role === "system")?.content || "";
  const contents = messages.filter((message) => message.role !== "system").map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: String(message.content || "") }],
  }));
  const upstream = await withTimeout(fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "X-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: 700 } }),
  }), 20000);
  if (!upstream.ok) { console.error(`Gemini request failed with status ${upstream.status} using model ${model}`); throw new Error("ai_upstream_failed"); }
  const payload = await upstream.json();
  const answer = payload.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("").trim();
  if (!answer) throw new Error("ai_empty_response");
  return answer;
}

function consumeRateLimit(userId: string) {
  const now = Date.now();
  const current = requestCounts.get(userId);
  if (!current || current.resetAt <= now) { requestCounts.set(userId, { count: 1, resetAt: now + rateWindowMs }); return true; }
  if (current.count >= maxRequestsPerWindow) return false;
  current.count += 1;
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  if (req.method !== "POST") return response(req, 405, { error: { code: "method_not_allowed", message: "Use POST." } });
  let body: any;
  try { body = await req.json(); } catch { return response(req, 400, { error: { code: "invalid_json", message: "The request body is invalid." } }); }

  const message = String(body.message || "").trim();
  if (!message || message.length > maxMessageLength) return response(req, 400, { error: { code: "invalid_message", message: "Message must contain between 1 and 1200 characters." } });
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return response(req, 401, { error: { code: "unauthorized", message: "Please sign in before using the assistant." } });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  if (!supabaseUrl || !anonKey) return response(req, 503, { error: { code: "auth_not_configured", message: "Assistant authentication is not configured." } });
  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const authResult = await supabase.auth.getUser(token);
  const user = authResult.data?.user;
  if (authResult.error || !user) return response(req, 401, { error: { code: "unauthorized", message: "Please sign in before using the assistant." } });
  if (!consumeRateLimit(user.id)) return response(req, 429, { error: { code: "rate_limited", message: "Too many assistant requests. Please try again in a few minutes." } });

  const history = Array.isArray(body.history) ? body.history.slice(-maxHistoryMessages).filter((item: any) => ["user", "assistant"].includes(item?.role) && typeof item.content === "string").map((item: any) => ({ role: item.role, content: item.content.slice(0, 1200) })) : [];
  const intent = detectIntent(message);
  const query = cleanQuery(message) || message.slice(0, 160);
  let searchResults: any = null;
  try {
    if (intent === "youtube_search") searchResults = await searchYouTube(query);
    if (intent === "media_search") searchResults = await searchMedia(query);
  } catch (error) { console.error("assistant search failed", error); searchResults = { unavailable: true, reason: "search_failed" }; }

  const context = JSON.stringify({ intent, query, siteMap, searchResults });
  let answer: string;
  try {
    answer = await callModel([{ role: "system", content: `${systemPrompt}\n\nServer-authorized IQZodiac context:\n${context}` }, ...history, { role: "user", content: message }]);
  } catch (error) {
    console.error("assistant model failed", error);
    const code = error instanceof Error && error.message === "ai_not_configured" ? "ai_not_configured" : "ai_unavailable";
    return response(req, 503, { error: { code, message: "The AI assistant is temporarily unavailable. Please try again later." } });
  }

  const conversationId = typeof body.conversationId === "string" && /^[0-9a-f-]{36}$/i.test(body.conversationId) ? body.conversationId : crypto.randomUUID();
  const logRows = [
    { user_id: user.id, conversation_id: conversationId, role: "user", content: message, intent, results: [] },
    { user_id: user.id, conversation_id: conversationId, role: "assistant", content: answer.slice(0, 4000), intent, results: Array.isArray(searchResults?.items) ? searchResults.items : [] },
  ];
  const { error: logError } = await supabase.from("assistant_conversation_logs").insert(logRows);
  if (logError) console.error("assistant log insert failed", logError.message);
  return response(req, 200, { answer, intent, results: searchResults?.items || [], conversationId });
});
