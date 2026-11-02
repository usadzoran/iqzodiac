import { Readability } from 'npm:@mozilla/readability@0.6.0';
import { DOMParser } from 'npm:linkedom@0.18.12';

const ALLOWED_ORIGIN = 'https://usadzoran.github.io';
const ALLOWED_HOSTS = [
  'npr.org', 'nbcnews.com', 'abcnews.com', 'cbsnews.com', 'nytimes.com',
  'bbc.com', 'bbc.co.uk', 'aljazeera.com', 'theguardian.com', 'dw.com', 'politico.com',
];
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
};

const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
});

const hostIsAllowed = (hostname: string) => {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return ALLOWED_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
};

const normalizeArticleUrl = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 3000) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !hostIsAllowed(url.hostname) || url.username || url.password) return null;
    url.hash = '';
    return url;
  } catch {
    return null;
  }
};

const hasAuthenticatedUser = async (request: Request) => {
  const authorization = request.headers.get('authorization') || '';
  const apiKey = request.headers.get('apikey') || '';
  const projectUrl = Deno.env.get('SUPABASE_URL');
  if (!/^Bearer\s+\S+/i.test(authorization) || !apiKey || !projectUrl) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${projectUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: apiKey, Authorization: authorization },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

const fetchPublisherPage = async (initialUrl: URL, signal: AbortSignal) => {
  let url = initialUrl;
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    const response = await fetch(url, {
      redirect: 'manual',
      signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IQZodiacReader/1.0; +https://usadzoran.github.io/iqzodiac/)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || redirects === 4) throw new Error('publisher_redirect_unavailable');
      const nextUrl = normalizeArticleUrl(new URL(location, url).toString());
      if (!nextUrl) throw new Error('publisher_redirect_blocked');
      url = nextUrl;
      continue;
    }
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(response.status === 401 || response.status === 402 || response.status === 403 || response.status === 429
        ? 'publisher_restricted'
        : 'publisher_unavailable');
    }
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      await response.body?.cancel();
      throw new Error('publisher_unavailable');
    }
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > 3_000_000) {
      await response.body?.cancel();
      throw new Error('publisher_page_too_large');
    }
    const html = await response.text();
    if (html.length > 3_000_000) throw new Error('publisher_page_too_large');
    return { html, finalUrl: url.toString() };
  }
  throw new Error('publisher_redirect_unavailable');
};

const extractBlocks = (content: string) => {
  const document = new DOMParser().parseFromString(`<html><body>${content}</body></html>`, 'text/html');
  const root = document.body;
  const blocks: { type: string; text: string }[] = [];
  for (const element of [...root.querySelectorAll('h2, h3, p, blockquote, li')]) {
    const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length < 35) continue;
    const type = element.tagName.toLowerCase();
    blocks.push({
      type: type === 'h2' || type === 'h3' ? 'heading' : type === 'blockquote' ? 'quote' : type === 'li' ? 'list' : 'paragraph',
      text: text.slice(0, 5000),
    });
    if (blocks.length >= 100) break;
  }
  return blocks;
};

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');
  if (origin && origin !== ALLOWED_ORIGIN) return jsonResponse({ error: 'origin_not_allowed' }, 403, { 'Access-Control-Allow-Origin': 'null' });
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, { Allow: 'POST, OPTIONS' });
  if (!await hasAuthenticatedUser(request)) return jsonResponse({ error: 'authentication_required' }, 401);

  let body: { articleUrl?: unknown; expectedTitle?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_request' }, 400);
  }
  const articleUrl = normalizeArticleUrl(body.articleUrl);
  if (!articleUrl) return jsonResponse({ error: 'unsupported_article_url' }, 400);
  const expectedTitle = typeof body.expectedTitle === 'string' ? body.expectedTitle.slice(0, 500) : '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 16000);
  try {
    const { html, finalUrl } = await fetchPublisherPage(articleUrl, controller.signal);
    const document = new DOMParser().parseFromString(html, 'text/html');
    const parsed = new Readability(document, { charThreshold: 300 }).parse();
    if (!parsed) return jsonResponse({ error: 'article_text_unavailable' }, 422);
    const blocks = extractBlocks(parsed.content || '');
    const textLength = blocks.reduce((total, block) => total + block.text.length, 0);
    if (textLength < 300) return jsonResponse({ error: 'article_text_unavailable' }, 422);
    return jsonResponse({
      title: String(parsed.title || expectedTitle).slice(0, 500),
      byline: String(parsed.byline || '').slice(0, 300),
      siteName: String(parsed.siteName || '').slice(0, 160),
      url: finalUrl,
      blocks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'publisher_unavailable';
    const status = message === 'unsupported_article_url' || message === 'publisher_redirect_blocked' ? 400
      : message === 'publisher_restricted' || message === 'article_text_unavailable' ? 422
      : message === 'publisher_page_too_large' ? 413
      : 502;
    return jsonResponse({ error: message }, status);
  } finally {
    clearTimeout(timeout);
  }
});
