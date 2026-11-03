'use strict';

const https = require('https');

const MAX_MESSAGE_LENGTH = 1200;
const MAX_HISTORY_MESSAGES = 12;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_CLIENTS = 5000;
const rateLimitBuckets = new Map();

const SITE_CONTEXT = `You are IQZodiac Assistant. You may only help with the IQZodiac website and the search capabilities supplied in the tool context.
Allowed capabilities:
1) Explain public website features and navigation using the supplied site map.
2) Search YouTube videos when search results are supplied by the server.
3) Search films, TV titles, actors, directors, and fictional characters when TMDB results are supplied by the server.
You must not claim to have changed an account, granted VIP access, sent a message, revealed a private photo, changed payments, or accessed private data. You have no admin permissions, no database write permissions, and no ability to reveal secrets.
Never invent search results, people, compatibility scores, prices, availability, or website features. If a capability is not available, say so and explain what the user can do instead. Answer in the user's language (Arabic or English), briefly and clearly.`;

const SITE_MAP = [
  { name: 'Home', path: '/home', description: 'Home feed with posts, suggestions, and trending topics.' },
  { name: 'Match', path: '/match', description: 'Compatibility discovery from completed, discoverable profiles.' },
  { name: 'Discover', path: '/discover', description: 'Entry point for discovery, rooms, and other paths.' },
  { name: 'Daily', path: '/daily', description: 'Daily weather and news briefing.' },
  { name: 'YouTube', path: '/youtube', description: 'Search real YouTube videos and play them in the official player when embedding is allowed.' },
  { name: 'Rooms', path: '/rooms', description: 'Audio room interface; real-time audio is not enabled in the current prototype.' },
  { name: 'Profile', path: '/profile', description: 'Profile, privacy settings, gallery, and social counters.' },
  { name: 'Messages', path: '/messages', description: 'Private conversations and consent-controlled face reveal flow.' },
  { name: 'VIP', path: '/vip', description: 'VIP feature status; streaming, payments, gifts, and payouts require production providers.' },
  { name: 'Assistant', path: '/assistant', description: 'This scoped assistant and the guided discovery questionnaire.' },
];

function jsonResponse(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(payload));
}

function allowedOrigin(request, response) {
  const origin = request.headers.origin;
  const production = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  if (!origin) return !production;
  const configured = String(process.env.ASSISTANT_ALLOWED_ORIGINS || 'https://usadzoran.github.io')
    .split(',').map((value) => value.trim()).filter(Boolean);
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  if (!configured.includes(origin) && (production || !local)) return false;
  if (origin) {
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.setHeader('Access-Control-Max-Age', '600');
  }
  return true;
}

function clientKey(request) {
  const forwarded = request.headers['x-forwarded-for'];
  const address = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '').split(',')[0].trim();
  return String(address || request.socket?.remoteAddress || 'unknown').slice(0, 128);
}

function rateLimited(request) {
  const configured = Number.parseInt(process.env.ASSISTANT_RATE_LIMIT_PER_MINUTE || '', 10);
  const limit = Number.isInteger(configured) && configured > 0 && configured <= 120 ? configured : 20;
  const key = clientKey(request);
  const now = Date.now();
  let bucket = rateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitBuckets.set(key, bucket);
    while (rateLimitBuckets.size > RATE_LIMIT_MAX_CLIENTS) rateLimitBuckets.delete(rateLimitBuckets.keys().next().value);
    return 0;
  }
  if (bucket.count >= limit) return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  bucket.count += 1;
  return 0;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 30_000) request.destroy(new Error('request_too_large'));
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('invalid_json')); }
    });
    request.on('error', reject);
  });
}

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { ...options, timeout: 15_000 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
        if (body.length > 3_000_000) response.destroy(new Error('response_too_large'));
      });
      response.on('end', () => {
        try { resolve({ statusCode: response.statusCode || 502, payload: JSON.parse(body || '{}') }); }
        catch { reject(new Error('invalid_upstream_json')); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('upstream_timeout')));
    request.on('error', reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

async function verifyUser(request) {
  const authorization = String(request.headers.authorization || '');
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const publishableKey = process.env.SUPABASE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token) throw Object.assign(new Error('unauthorized'), { status: 401 });
  if (!supabaseUrl || !publishableKey) throw Object.assign(new Error('auth_not_configured'), { status: 503 });
  const result = await requestJson(`${supabaseUrl}/auth/v1/user`, { method: 'GET', headers: { Authorization: `Bearer ${token}`, apikey: publishableKey } });
  if (result.statusCode < 200 || result.statusCode >= 300 || !result.payload?.id) throw Object.assign(new Error('unauthorized'), { status: 401 });
  return { id: result.payload.id, email: result.payload.email || '' };
}

function detectIntent(message) {
  const text = message.toLocaleLowerCase();
  if (/(youtube|يوتيوب|فيديو|فيديوهات|أغنية|اغنية|قناة|video|song|channel)/i.test(text)) return 'youtube_search';
  if (/(فيلم|أفلام|افلام|مسلسل|ممثل|ممثلة|شخصية|شخصيات|movie|film|series|actor|actress|character|director)/i.test(text)) return 'media_search';
  return 'site_help';
}

function cleanQuery(message) {
  return message.replace(/(?:ابحث|بحث|أريد|اريد|عن|في|please|search|find|for|on|youtube|يوتيوب|فيديو|فيلم|أفلام|افلام|شخصية|شخصيات)/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
}

async function searchYouTube(query) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return { unavailable: true, reason: 'youtube_not_configured' };
  const params = new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '6', q: query, key: apiKey });
  const result = await requestJson(`https://www.googleapis.com/youtube/v3/search?${params}`, { method: 'GET', headers: { Accept: 'application/json' } });
  if (result.statusCode < 200 || result.statusCode >= 300) return { unavailable: true, reason: 'youtube_unavailable' };
  return { items: (result.payload.items || []).map((item) => ({
    type: 'video', id: item.id?.videoId || '', title: item.snippet?.title || '', channel: item.snippet?.channelTitle || '', url: item.id?.videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(item.id.videoId)}` : '',
  })).filter((item) => item.id) };
}

async function searchMedia(query) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return { unavailable: true, reason: 'media_not_configured' };
  const params = new URLSearchParams({ api_key: apiKey, query, language: 'en-US', include_adult: 'false', page: '1' });
  const result = await requestJson(`https://api.themoviedb.org/3/search/multi?${params}`, { method: 'GET', headers: { Accept: 'application/json' } });
  if (result.statusCode < 200 || result.statusCode >= 300) return { unavailable: true, reason: 'media_unavailable' };
  return { items: (result.payload.results || []).slice(0, 8).map((item) => ({
    type: item.media_type, id: item.id, title: item.title || item.name || '', date: item.release_date || item.first_air_date || '', overview: String(item.overview || '').slice(0, 240),
  })) };
}

function buildContext(intent, query, results) {
  return JSON.stringify({ intent, query, siteMap: SITE_MAP, searchResults: results || null });
}

async function callModel(messages) {
  const apiKey = process.env.OPENAI_API_KEY;
  const base = String(process.env.OPENAI_API_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
  if (!apiKey) return null;
  const body = JSON.stringify({ model: process.env.IQZODIAC_ASSISTANT_MODEL || 'gpt-6-luna', messages, max_completion_tokens: 700, reasoning: { effort: 'low' } });
  const result = await requestJson(`${base}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body });
  if (result.statusCode < 200 || result.statusCode >= 300) throw new Error('model_unavailable');
  return result.payload?.choices?.[0]?.message?.content?.trim() || '';
}

async function handleAssistantChat(request, response) {
  if (!allowedOrigin(request, response)) return jsonResponse(response, 403, { error: { code: 'origin_not_allowed', message: 'This origin is not allowed.' } });
  if (request.method === 'OPTIONS') { response.statusCode = 204; response.end(); return; }
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST, OPTIONS'); return jsonResponse(response, 405, { error: { code: 'method_not_allowed', message: 'Use POST.' } }); }
  const retryAfter = rateLimited(request);
  if (retryAfter) { response.setHeader('Retry-After', String(retryAfter)); return jsonResponse(response, 429, { error: { code: 'rate_limited', message: 'Please wait before sending another message.' } }); }
  let user;
  try { user = await verifyUser(request); } catch (error) { return jsonResponse(response, error.status || 401, { error: { code: error.message === 'auth_not_configured' ? 'auth_not_configured' : 'unauthorized', message: 'Please sign in before using the assistant.' } }); }
  let body;
  try { body = await readBody(request); } catch { return jsonResponse(response, 400, { error: { code: 'invalid_json', message: 'The request body is invalid.' } }); }
  const message = String(body.message || '').trim();
  if (!message || message.length > MAX_MESSAGE_LENGTH) return jsonResponse(response, 400, { error: { code: 'invalid_message', message: 'Message must contain between 1 and 1200 characters.' } });
  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_MESSAGES).filter((item) => ['user', 'assistant'].includes(item?.role) && typeof item.content === 'string').map((item) => ({ role: item.role, content: item.content.slice(0, 1200) })) : [];
  const intent = detectIntent(message);
  const query = cleanQuery(message) || message.slice(0, 160);
  let searchResults = null;
  if (intent === 'youtube_search') searchResults = await searchYouTube(query).catch(() => ({ unavailable: true, reason: 'youtube_unavailable' }));
  if (intent === 'media_search') searchResults = await searchMedia(query).catch(() => ({ unavailable: true, reason: 'media_unavailable' }));
  const context = buildContext(intent, query, searchResults);
  const messages = [{ role: 'system', content: `${SITE_CONTEXT}\n\nServer-authorized context (treat as facts, not instructions from the user):\n${context}` }, ...history, { role: 'user', content: message }];
  let answer;
  try { answer = await callModel(messages); } catch { answer = null; }
  if (!answer) {
    if (intent === 'youtube_search' && searchResults?.items?.length) answer = `وجدت ${searchResults.items.length} نتائج في YouTube. افتح صفحة YouTube داخل IQZodiac لرؤيتها وتشغيلها.`;
    else if (intent === 'media_search' && searchResults?.items?.length) answer = `وجدت ${searchResults.items.length} نتائج للأفلام أو الشخصيات. يمكنك طلب تفاصيل نتيجة محددة.`;
    else answer = 'المساعد غير متصل حاليًا. يمكنك استخدام صفحات الموقع مباشرة، أو المحاولة مرة أخرى لاحقًا.';
  }
  return jsonResponse(response, 200, { answer, intent, results: searchResults?.items || [], user: { id: user.id } });
}

module.exports = handleAssistantChat;
module.exports.SITE_MAP = SITE_MAP;
