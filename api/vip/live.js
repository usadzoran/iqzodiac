'use strict';

const supabase = require('../../public/supabase-public-config.json');

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(payload));
}

function isLocalOrigin(origin) {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  response.setHeader('Vary', 'Origin');
  const production = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  if (!origin) return true;
  const allowedOrigins = String(process.env.IQZODIAC_ALLOWED_ORIGINS || 'https://usadzoran.github.io')
    .split(',').map((value) => value.trim()).filter(Boolean);
  if (!allowedOrigins.includes(origin) && (production || !isLocalOrigin(origin))) return false;
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Accept, Authorization');
  response.setHeader('Access-Control-Max-Age', '600');
  return true;
}

module.exports = async function handleVipLive(request, response) {
  if (!applyCors(request, response)) {
    sendJson(response, 403, { error: { code: 'origin_not_allowed', message: 'This origin is not allowed.' } });
    return;
  }
  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.setHeader('Cache-Control', 'no-store');
    response.end();
    return;
  }
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET, OPTIONS');
    sendJson(response, 405, { error: { code: 'method_not_allowed', message: 'Use GET.' } });
    return;
  }

  const authorization = String(request.headers.authorization || '');
  const tokenMatch = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!tokenMatch) {
    sendJson(response, 401, { error: { code: 'authentication_required', message: 'A Supabase Auth session is required. Local profile roles do not grant access.' } });
    return;
  }
  if (!supabase.supabaseUrl || !supabase.publishableKey.startsWith('sb_publishable_')) {
    sendJson(response, 503, { error: { code: 'supabase_not_configured', message: 'VIP access verification is not configured.' } });
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
      signal: AbortSignal.timeout(12000),
    });
    if (!authResponse.ok) {
      sendJson(response, 401, { error: { code: 'invalid_auth_session', message: 'The Supabase Auth session is invalid or expired.' } });
      return;
    }
    const user = await authResponse.json();
    if (!user || typeof user.id !== 'string') {
      sendJson(response, 401, { error: { code: 'invalid_auth_session', message: 'The Supabase Auth session could not be verified.' } });
      return;
    }

    const roleUrl = new URL(`${supabase.supabaseUrl}/rest/v1/vip_user_roles`);
    roleUrl.search = new URLSearchParams({
      select: 'role',
      user_id: `eq.${user.id}`,
      is_active: 'eq.true',
    }).toString();
    const roleResponse = await fetch(roleUrl, { headers, cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!roleResponse.ok) {
      sendJson(response, 503, { error: { code: 'vip_authorization_unavailable', message: 'VIP membership could not be verified.' } });
      return;
    }
    const roleRows = await roleResponse.json();
    const roles = Array.isArray(roleRows) ? roleRows.map((row) => row.role) : [];
    if (!roles.includes('vip') && !roles.includes('admin')) {
      sendJson(response, 403, { error: { code: 'vip_membership_required', message: 'This area is reserved for verified VIP members.' } });
      return;
    }

    // Deliberately fail closed until an actual WebRTC/HLS provider is configured and integrated.
    sendJson(response, 503, {
      error: { code: 'stream_provider_not_connected', message: 'VIP access is verified, but live video is not available yet.' },
      liveStreamingEnabled: false,
      sessions: [],
    });
  } catch {
    sendJson(response, 503, { error: { code: 'vip_service_unavailable', message: 'VIP access verification is temporarily unavailable.' } });
  }
};
