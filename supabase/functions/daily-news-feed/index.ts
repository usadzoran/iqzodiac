const ALLOWED_ORIGIN = 'https://usadzoran.github.io';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
};

const SOURCES = [
  { key: 'npr', name: 'NPR', category: 'world', url: 'https://feeds.npr.org/1001/rss.xml' },
  { key: 'nbc-news', name: 'NBC News', category: 'world', url: 'https://feeds.nbcnews.com/nbcnews/public/news' },
  { key: 'abc-news', name: 'ABC News', category: 'world', url: 'https://abcnews.go.com/abcnews/topstories' },
  { key: 'cbs-news', name: 'CBS News', category: 'world', url: 'https://www.cbsnews.com/latest/rss/main' },
  { key: 'new-york-times-homepage', name: 'New York Times', category: 'world', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
  { key: 'bbc-world', name: 'BBC World', category: 'world', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { key: 'al-jazeera', name: 'Al Jazeera', category: 'world', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { key: 'the-guardian', name: 'The Guardian', category: 'world', url: 'https://www.theguardian.com/world/rss' },
  { key: 'deutsche-welle', name: 'Deutsche Welle', category: 'world', url: 'https://rss.dw.com/xml/rss-en-all' },
  { key: 'technology', name: 'Technology', category: 'technology', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml' },
  { key: 'business', name: 'Business', category: 'business', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml' },
  { key: 'politics', name: 'Politics', category: 'world', url: 'https://rss.politico.com/politics-news.xml' },
];

const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
});

const decodeEntities = (value: string) => String(value || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&#([0-9]+);/g, (_match, code) => String.fromCodePoint(Number(code)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');

const plainText = (value: string) => decodeEntities(String(value || ''))
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);

const firstTag = (block: string, names: string[]) => {
  for (const name of names) {
    const escapedName = name.replace(':', '\\:');
    const match = block.match(new RegExp(`<${escapedName}\\b[^>]*>([\\s\\S]*?)<\\/${escapedName}\\s*>`, 'i'));
    if (match?.[1]) return match[1];
  }
  return '';
};

const safeHttpsUrl = (value: string) => {
  const decoded = decodeEntities(String(value || '').trim()).replace(/^['"]|['"]$/g, '');
  try {
    const url = new URL(decoded);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
};

const imageFromItem = (block: string) => {
  const mediaTags = [...block.matchAll(/<(?:media:)?(?:content|thumbnail|enclosure)\b([^>]*)>/gi)];
  for (const match of mediaTags) {
    const attributes = match[1] || '';
    const url = (attributes.match(/\b(?:url|href)\s*=\s*["']([^"']+)["']/i) || [])[1];
    const type = (attributes.match(/\btype\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
    const isThumbnail = /thumbnail/i.test(match[0]);
    if (url && (isThumbnail || !type || /^image\//i.test(type))) {
      const safeUrl = safeHttpsUrl(url);
      if (safeUrl) return safeUrl;
    }
  }
  const inlineImage = block.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i);
  return inlineImage ? safeHttpsUrl(inlineImage[1]) || null : null;
};

const extractLink = (block: string) => {
  const atom = block.match(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/i);
  const textLink = firstTag(block, ['link']);
  return safeHttpsUrl(atom?.[1] || plainText(textLink));
};

const parseFeed = (xml: string, source: typeof SOURCES[number]) => {
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1\s*>/gi)].map((match) => match[0]);
  return blocks.map((block) => {
    const articleUrl = extractLink(block);
    const externalId = plainText(firstTag(block, ['guid', 'id'])) || articleUrl;
    const description = plainText(firstTag(block, ['description', 'summary', 'content:encoded', 'content']));
    const dateText = plainText(firstTag(block, ['pubDate', 'published', 'updated', 'dc:date']));
    const parsedDate = dateText ? new Date(dateText) : null;
    const publishedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null;
    return {
      externalId: externalId.slice(0, 1000),
      title: plainText(firstTag(block, ['title'])).slice(0, 500),
      description,
      articleUrl,
      imageUrl: imageFromItem(block),
      publishedAt,
      sourceKey: source.key,
      sourceName: source.name,
      category: source.category,
    };
  }).filter((item) => item.externalId && item.title && item.articleUrl);
};

const fetchSource = async (source: typeof SOURCES[number]) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(source.url, {
      headers: { 'User-Agent': 'IQZodiac Daily News/1.0', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`RSS returned ${response.status}`);
    const xml = await response.text();
    return parseFeed(xml, source).slice(0, 12);
  } finally {
    clearTimeout(timeout);
  }
};

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');
  if (origin && origin !== ALLOWED_ORIGIN) return jsonResponse({ error: 'origin_not_allowed' }, 403, { 'Access-Control-Allow-Origin': 'null' });
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, { Allow: 'POST, OPTIONS' });

  const results = await Promise.allSettled(SOURCES.map(fetchSource));
  const articles = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  const uniqueArticles = [...new Map(articles.map((item) => [`${item.sourceKey}:${item.externalId}`, item])).values()];
  uniqueArticles.sort((left, right) => (Date.parse(right.publishedAt || '') || 0) - (Date.parse(left.publishedAt || '') || 0));
  const illustratedStories = uniqueArticles.filter((item) => item.imageUrl && item.description);
  const summarizedStories = uniqueArticles.filter((item) => item.description);
  const items = (illustratedStories.length >= 8 ? illustratedStories : summarizedStories).slice(0, 36);
  if (!items.length) return jsonResponse({ error: 'news_temporarily_unavailable', items: [] }, 503);
  return jsonResponse({ fetchedAt: new Date().toISOString(), items });
});
