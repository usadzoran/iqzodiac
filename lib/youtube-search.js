'use strict';

const https = require('https');
const SEARCH_CACHE_TTL_MS = 30_000;
const SEARCH_CACHE_MAX_ENTRIES = 100;
const searchCache = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_CLIENTS = 5000;
const rateLimitBuckets = new Map();

function responseJson(response, status, payload, cacheControl = 'no-store') {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', cacheControl);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(payload));
}

function localOrigin(origin) {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  response.setHeader('Vary', 'Origin');
  const production = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  if (!origin) return !production;
  const configured = String(process.env.YOUTUBE_ALLOWED_ORIGINS || 'https://usadzoran.github.io')
    .split(',').map((value) => value.trim()).filter(Boolean);
  if (!configured.includes(origin) && (production || !localOrigin(origin))) return false;
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Accept');
  response.setHeader('Access-Control-Max-Age', '600');
  return true;
}

function rateLimitDelay(request) {
  const configuredLimit = Number.parseInt(process.env.YOUTUBE_RATE_LIMIT_PER_MINUTE || '', 10);
  const limit = Number.isInteger(configuredLimit) && configuredLimit > 0 && configuredLimit <= 1000 ? configuredLimit : 30;
  const forwarded = request.headers['x-forwarded-for'];
  const firstForwardedAddress = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '').split(',')[0].trim();
  const clientAddress = String(firstForwardedAddress || request.socket?.remoteAddress || 'unknown').slice(0, 128);
  const now = Date.now();
  let bucket = rateLimitBuckets.get(clientAddress);
  if (!bucket || bucket.resetAt <= now) {
    if (bucket) rateLimitBuckets.delete(clientAddress);
    if (rateLimitBuckets.size >= RATE_LIMIT_MAX_CLIENTS) {
      const oldestAddress = rateLimitBuckets.keys().next().value;
      if (oldestAddress) rateLimitBuckets.delete(oldestAddress);
    }
    bucket = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitBuckets.set(clientAddress, bucket);
  } else if (bucket.count >= limit) {
    return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  } else {
    bucket.count += 1;
  }
  return 0;
}

function requestYouTube(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'IQZodiac YouTube Search/1.0' },
      timeout: 12_000,
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
        if (body.length > 2_000_000) response.destroy(new Error('YouTube response was too large'));
      });
      response.on('error', reject);
      response.on('end', () => {
        try {
          resolve({ statusCode: Number(response.statusCode || 502), payload: JSON.parse(body || '{}') });
        } catch {
          reject(new Error('YouTube returned invalid JSON'));
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('YouTube request timed out')));
    request.on('error', reject);
  });
}

function youtubeFailure(statusCode, payload) {
  const reasons = payload?.error?.errors?.map((entry) => entry.reason).filter(Boolean) || [];
  if (reasons.some((reason) => ['quotaExceeded', 'dailyLimitExceeded', 'dailyLimitExceededUnreg', 'userRateLimitExceeded'].includes(reason))) {
    return { status: 429, error: { code: 'quota_exceeded', message: 'YouTube API quota is unavailable.' } };
  }
  if (reasons.some((reason) => ['keyInvalid', 'accessNotConfigured', 'apiNotActivated', 'ipRefererBlocked', 'forbidden'].includes(reason))) {
    return { status: 503, error: { code: 'api_configuration', message: 'YouTube API configuration is invalid.' } };
  }
  if (statusCode === 400) return { status: 400, error: { code: 'invalid_query', message: 'The search request is invalid.' } };
  return { status: 502, error: { code: 'upstream_unavailable', message: 'YouTube search is temporarily unavailable.' } };
}

function normalizeResult(item) {
  const snippet = item?.snippet || {};
  const videoId = item?.id?.videoId;
  if (typeof videoId !== 'string' || !videoId) return null;
  const thumbnails = snippet.thumbnails || {};
  const thumbnail = thumbnails.high || thumbnails.medium || thumbnails.default || thumbnails.standard || thumbnails.maxres || {};
  return {
    videoId,
    title: String(snippet.title || ''),
    channelTitle: String(snippet.channelTitle || ''),
    publishedAt: typeof snippet.publishedAt === 'string' ? snippet.publishedAt : '',
    thumbnailUrl: typeof thumbnail.url === 'string' ? thumbnail.url : '',
  };
}

async function handleYouTubeSearch(request, response) {
  if (!applyCors(request, response)) {
    responseJson(response, 403, { error: { code: 'origin_not_allowed', message: 'This origin is not allowed.' } });
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
    responseJson(response, 405, { error: { code: 'method_not_allowed', message: 'Use GET.' } });
    return;
  }
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    responseJson(response, 503, { error: { code: 'api_not_configured', message: 'The server-side YOUTUBE_API_KEY is not configured.' } });
    return;
  }

  let parsed;
  try { parsed = new URL(request.url, 'https://iqzodiac.invalid'); } catch {
    responseJson(response, 400, { error: { code: 'invalid_query', message: 'The search URL is invalid.' } });
    return;
  }
  const query = String(parsed.searchParams.get('q') || '').trim();
  const pageToken = String(parsed.searchParams.get('pageToken') || '').trim();
  if (!query || query.length > 160) {
    responseJson(response, 400, { error: { code: 'invalid_query', message: 'Search must contain 1 to 160 characters.' } });
    return;
  }
  if (pageToken.length > 1024) {
    responseJson(response, 400, { error: { code: 'invalid_page_token', message: 'The page token is invalid.' } });
    return;
  }

  const retryAfter = rateLimitDelay(request);
  if (retryAfter) {
    response.setHeader('Retry-After', String(retryAfter));
    responseJson(response, 429, { error: { code: 'rate_limited', message: 'Please wait before searching again.' } });
    return;
  }

  const cacheKey = `${query.toLocaleLowerCase('en-US')}\u0000${pageToken}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    responseJson(response, 200, cached.payload, 'public, max-age=15, s-maxage=30, stale-while-revalidate=30');
    return;
  }
  if (cached) searchCache.delete(cacheKey);

  const params = new URLSearchParams({
    part: 'snippet', type: 'video', maxResults: '12', q: query, key: apiKey,
  });
  if (pageToken) params.set('pageToken', pageToken);
  const endpoint = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;

  try {
    const upstream = await requestYouTube(endpoint);
    if (upstream.statusCode < 200 || upstream.statusCode >= 300) {
      const failure = youtubeFailure(upstream.statusCode, upstream.payload);
      responseJson(response, failure.status, { error: failure.error });
      return;
    }
    const payload = {
      items: Array.isArray(upstream.payload.items) ? upstream.payload.items.map(normalizeResult).filter(Boolean) : [],
      nextPageToken: typeof upstream.payload.nextPageToken === 'string' ? upstream.payload.nextPageToken : '',
    };
    searchCache.set(cacheKey, { payload, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
    while (searchCache.size > SEARCH_CACHE_MAX_ENTRIES) searchCache.delete(searchCache.keys().next().value);
    responseJson(response, 200, payload, 'public, max-age=15, s-maxage=30, stale-while-revalidate=30');
  } catch {
    responseJson(response, 502, { error: { code: 'upstream_unavailable', message: 'YouTube search is temporarily unavailable.' } });
  }
}

module.exports = handleYouTubeSearch;
