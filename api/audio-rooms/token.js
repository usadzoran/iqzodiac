'use strict';

const { AccessToken } = require('livekit-server-sdk');
const supabase = require('../../public/supabase-public-config.json');

const ROOM_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, private');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(payload));
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  response.setHeader('Vary', 'Origin');
  if (!origin) return true;

  const allowedOrigins = String(process.env.IQZODIAC_ALLOWED_ORIGINS || 'https://usadzoran.github.io')
    .split(',').map((value) => value.trim()).filter(Boolean);
  const localOrigin = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  const previewOrigin = /^https:\/\/(?:[a-z0-9-]+\.)*manus\.computer$/i.test(origin);
  const production = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  let sameHttpsHost = false;
  try {
    const parsedOrigin = new URL(origin);
    sameHttpsHost = parsedOrigin.protocol === 'https:' && parsedOrigin.host.toLowerCase() === String(request.headers.host || '').toLowerCase();
  } catch { /* Reject malformed origins below. */ }
  if (!allowedOrigins.includes(origin) && !sameHttpsHost && (production || (!localOrigin && !previewOrigin))) return false;

  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Accept, Authorization, Content-Type');
  response.setHeader('Access-Control-Max-Age', '600');
  return true;
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) return request.body;
  if (Buffer.isBuffer(request.body)) return JSON.parse(request.body.toString('utf8'));

  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 4096) throw new Error('request_too_large');
  }
  return body ? JSON.parse(body) : {};
}

module.exports = async function handleAudioRoomToken(request, response) {
  if (!applyCors(request, response)) {
    sendJson(response, 403, { error: { code: 'origin_not_allowed' } });
    return;
  }
  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.setHeader('Cache-Control', 'no-store');
    response.end();
    return;
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST, OPTIONS');
    sendJson(response, 405, { error: { code: 'method_not_allowed' } });
    return;
  }

  const authorization = String(request.headers.authorization || '');
  const tokenMatch = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!tokenMatch) {
    sendJson(response, 401, { error: { code: 'authentication_required' } });
    return;
  }
  if (!supabase.supabaseUrl || !String(supabase.publishableKey || '').startsWith('sb_publishable_')) {
    sendJson(response, 503, { error: { code: 'supabase_not_configured' } });
    return;
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch {
    sendJson(response, 400, { error: { code: 'invalid_request_body' } });
    return;
  }
  const roomId = String(body.roomId || '').trim();
  if (!ROOM_ID_PATTERN.test(roomId)) {
    sendJson(response, 400, { error: { code: 'invalid_room_id' } });
    return;
  }

  const headers = {
    apikey: supabase.publishableKey,
    Authorization: `Bearer ${tokenMatch[1]}`,
    Accept: 'application/json',
  };

  try {
    const authResponse = await fetch(`${supabase.supabaseUrl}/auth/v1/user`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!authResponse.ok) {
      sendJson(response, 401, { error: { code: 'invalid_auth_session' } });
      return;
    }
    const user = await authResponse.json();
    if (!user || typeof user.id !== 'string') {
      sendJson(response, 401, { error: { code: 'invalid_auth_session' } });
      return;
    }

    const profileQuery = new URLSearchParams({
      select: 'display_name,handle',
      user_id: `eq.${user.id}`,
      limit: '1',
    });
    let participantName = 'عضو IQZodiac';
    try {
      const profileResponse = await fetch(`${supabase.supabaseUrl}/rest/v1/profiles?${profileQuery}`, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      });
      if (profileResponse.ok) {
        const profiles = await profileResponse.json();
        const profile = Array.isArray(profiles) ? profiles[0] : null;
        participantName = String(profile?.display_name || profile?.handle || participantName).replace(/[<>\u0000-\u001f]/g, '').slice(0, 80) || participantName;
      }
    } catch { /* Profile display is optional; never block a valid room token on it. */ }

    const livekitUrl = String(process.env.LIVEKIT_URL || '').trim().replace(/\/+$/, '');
    const apiKey = String(process.env.LIVEKIT_API_KEY || '').trim();
    const apiSecret = String(process.env.LIVEKIT_API_SECRET || '').trim();
    if (!/^wss:\/\//i.test(livekitUrl) || !apiKey || !apiSecret) {
      sendJson(response, 503, { error: { code: 'livekit_not_configured' } });
      return;
    }

    const roomQuery = new URLSearchParams({
      select: 'id,host_user_id,title,category',
      id: `eq.${roomId}`,
      status: 'eq.open',
      limit: '1',
    });
    const roomResponse = await fetch(`${supabase.supabaseUrl}/rest/v1/audio_rooms?${roomQuery}`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!roomResponse.ok) {
      sendJson(response, 503, { error: { code: 'room_service_unavailable' } });
      return;
    }
    const rows = await roomResponse.json();
    const room = Array.isArray(rows) ? rows[0] : null;
    if (!room) {
      sendJson(response, 404, { error: { code: 'room_not_open' } });
      return;
    }

    const roomName = `iqzodiac-audio-${room.id}`;
    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: participantName,
      ttl: '15m',
    });
    accessToken.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });
    const jwt = await accessToken.toJwt();

    sendJson(response, 200, {
      token: jwt,
      serverUrl: livekitUrl,
      room: { id: room.id, title: room.title, category: room.category },
      participant: { identity: user.id, name: participantName, isHost: room.host_user_id === user.id },
    });
  } catch {
    sendJson(response, 503, { error: { code: 'audio_room_service_unavailable' } });
  }
};
