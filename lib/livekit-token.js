'use strict';

const crypto = require('crypto');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const base64url = (value) => Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const jsonBase64url = (value) => base64url(JSON.stringify(value));
const responseJson = (res, status, payload, headers = {}) => { res.statusCode = status; Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value)); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(payload)); };
const allowedOrigins = () => String(process.env.LIVEKIT_ALLOWED_ORIGINS || 'https://usadzoran.github.io,http://localhost:3000').split(',').map((origin) => origin.trim()).filter(Boolean);
const applyCors = (req, res) => {
  const origin = String(req.headers.origin || '');
  if (!origin || !allowedOrigins().includes(origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  return true;
};
const bearer = (req) => { const match = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || '').trim()); return match?.[1] || ''; };
const supabaseRequest = async (path, accessToken, options = {}) => {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '');
  if (!supabaseUrl || !supabaseKey) throw new Error('supabase_not_configured');
  const response = await fetch(`${supabaseUrl}${path}`, { ...options, headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken}`, Accept: 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => null);
  return { response, body };
};
const signToken = (user, roomName, canPublish) => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: String(process.env.LIVEKIT_API_KEY),
    sub: user.id,
    name: String(user.user_metadata?.display_name || user.user_metadata?.name || 'IQZodiac member').slice(0, 80),
    iat: now,
    nbf: now - 5,
    exp: now + 3600,
    video: { roomJoin: true, room: roomName, canPublish: Boolean(canPublish), canSubscribe: true, canPublishData: true },
  };
  const encoded = `${jsonBase64url(header)}.${jsonBase64url(payload)}`;
  const signature = base64url(crypto.createHmac('sha256', String(process.env.LIVEKIT_API_SECRET)).update(encoded).digest());
  return `${encoded}.${signature}`;
};
const getRoomAccess = async (type, roomId, accessToken, userId) => {
  if (type === 'audio') {
    const query = encodeURIComponent(roomId);
    const roomResult = await supabaseRequest(`/rest/v1/audio_rooms?id=eq.${query}&select=id,host_user_id,visibility,status&limit=1`, accessToken);
    if (!roomResult.response.ok || !roomResult.body?.[0] || roomResult.body[0].status !== 'open') return null;
    const room = roomResult.body[0];
    if (room.visibility === 'private' && room.host_user_id !== userId) {
      const memberResult = await supabaseRequest(`/rest/v1/audio_room_members?room_id=eq.${query}&user_id=eq.${encodeURIComponent(userId)}&removed_at=is.null&select=user_id&limit=1`, accessToken);
      if (!memberResult.response.ok || !memberResult.body?.[0]) return null;
    }
    return { roomName: `iqz-audio-${roomId}`, canPublish: true };
  }
  const query = encodeURIComponent(roomId);
  const sessionResult = await supabaseRequest(`/rest/v1/vip_live_sessions?id=eq.${query}&select=id,host_user_id,visibility,status&limit=1`, accessToken);
  if (!sessionResult.response.ok || !sessionResult.body?.[0]) return null;
  const session = sessionResult.body[0];
  if (!['scheduled', 'live'].includes(session.status)) return null;
  return { roomName: `iqz-live-${roomId}`, canPublish: session.host_user_id === userId };
};

async function handleLiveKitToken(request, response) {
  if (!applyCors(request, response)) { responseJson(response, 403, { error: { code: 'origin_not_allowed', message: 'This origin is not allowed.' } }); return; }
  if (request.method === 'OPTIONS') { response.statusCode = 204; response.end(); return; }
  if (request.method !== 'GET') { response.setHeader('Allow', 'GET, OPTIONS'); responseJson(response, 405, { error: { code: 'method_not_allowed', message: 'Use GET.' } }); return; }
  if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) { responseJson(response, 503, { error: { code: 'livekit_not_configured', message: 'LiveKit is not configured on the server.' } }); return; }
  const accessToken = bearer(request);
  if (!accessToken) { responseJson(response, 401, { error: { code: 'auth_required', message: 'A Supabase access token is required.' } }); return; }
  const userResult = await supabaseRequest('/auth/v1/user', accessToken);
  if (!userResult.response.ok || !userResult.body?.id) { responseJson(response, 401, { error: { code: 'invalid_session', message: 'The account session is invalid or expired.' } }); return; }
  let parsed;
  try { parsed = new URL(request.url, 'https://iqzodiac.invalid'); } catch { responseJson(response, 400, { error: { code: 'invalid_request', message: 'The request URL is invalid.' } }); return; }
  const type = parsed.searchParams.get('type') === 'live' ? 'live' : 'audio';
  const roomId = String(parsed.searchParams.get('roomId') || '');
  if (!UUID_RE.test(roomId)) { responseJson(response, 400, { error: { code: 'invalid_room', message: 'A valid room id is required.' } }); return; }
  const access = await getRoomAccess(type, roomId, accessToken, userResult.body.id);
  if (!access) { responseJson(response, 403, { error: { code: 'room_access_denied', message: 'You do not have access to this room.' } }); return; }
  const token = signToken(userResult.body, access.roomName, access.canPublish);
  responseJson(response, 200, { token, url: String(process.env.LIVEKIT_URL), roomName: access.roomName, canPublish: access.canPublish }, { 'Cache-Control': 'no-store' });
}

module.exports = handleLiveKitToken;
