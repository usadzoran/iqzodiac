const https = require('https');
const sourceGroups = require('../discover-news-sources');

const sources = sourceGroups.flatMap((group) => group.sources.map((source) => ({ ...source, category: group.category })));

const fetchText = (url, redirectCount = 0) => new Promise((resolve, reject) => {
  const request = https.get(url, {
    headers: { 'User-Agent': 'IQZodiac Discover News/1.0', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
  }, (response) => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => { body += chunk; });
    response.on('end', () => {
      if (response.statusCode >= 200 && response.statusCode < 300) { resolve(body); return; }
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location && redirectCount < 3) {
        fetchText(new URL(response.headers.location, url).toString(), redirectCount + 1).then(resolve, reject);
        return;
      }
      reject(new Error(`Upstream ${response.statusCode}`));
    });
  });
  request.setTimeout(10000, () => request.destroy(new Error('Upstream timeout')));
  request.on('error', reject);
});

const decodeXML = (value) => String(value || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ').trim();

const firstTag = (block, tag) => decodeXML((block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')) || [])[1]);
const atomLink = (block) => {
  const link = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  return link ? link[1].trim() : firstTag(block, 'link');
};
const mediaImage = (block) => {
  const media = block.match(/<(?:media:)?(?:content|thumbnail|enclosure)\b[^>]*(?:url|href)=["']([^"']+)["'][^>]*>/i);
  return media && /^https:\/\//i.test(media[1]) ? media[1] : null;
};
const parseDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
};
const parseFeed = (xml) => {
  const blocks = [...String(xml || '').matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((match) => match[0]);
  return blocks.map((block) => ({
    externalId: firstTag(block, 'guid') || firstTag(block, 'id') || atomLink(block),
    title: firstTag(block, 'title'),
    description: (firstTag(block, 'description') || firstTag(block, 'summary') || firstTag(block, 'content')).slice(0, 4000),
    articleUrl: firstTag(block, 'link') || atomLink(block),
    imageUrl: mediaImage(block),
    publishedAt: parseDate(firstTag(block, 'pubDate') || firstTag(block, 'published') || firstTag(block, 'updated')),
  })).filter((item) => item.externalId && item.title && /^https:\/\//i.test(item.articleUrl));
};

const fetchDiscoverNews = async () => {
  const results = await Promise.all(sources.map(async (source) => {
    try {
      const xml = await fetchText(source.url);
      return { ...source, items: parseFeed(xml).slice(0, 12), error: null };
    } catch (error) {
      return { ...source, items: [], error: error.message || 'source_unavailable' };
    }
  }));
  return { fetchedAt: new Date().toISOString(), sources: results };
};

module.exports = { sources, fetchDiscoverNews };
