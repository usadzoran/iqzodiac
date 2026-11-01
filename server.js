const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const handleYouTubeSearch = require('./lib/youtube-search');
const handleVipLive = require('./api/vip/live');

const root = __dirname;
const port = Number(process.env.PORT || 3000);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
};
const routeFiles = {
  '/profile': 'profile.html',
  '/home': 'home.html',
  '/signup': 'signup.html',
  '/login': 'login.html',
  '/discover': 'discover.html',
  '/assistant': 'assistant.html',
  '/rooms': 'rooms.html',
  '/messages': 'messages.html',
  '/match': 'match.html',
  '/daily': 'daily.html',
  '/vip': 'vip.html',
  '/vip-live': 'vip-live.html',
  '/gift-store': 'gift-store.html',
  '/wallet': 'wallet.html',
  '/youtube': 'youtube.html',
};
const fetchText = (url) => new Promise((resolve, reject) => {
  const request = https.get(url, { headers: { 'User-Agent': 'IQZodiac Daily/1.0' } }, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => res.statusCode >= 200 && res.statusCode < 300 ? resolve(body) : reject(new Error(`Upstream ${res.statusCode}`)));
  });
  request.setTimeout(8000, () => request.destroy(new Error('Upstream timeout')));
  request.on('error', reject);
});
const decodeXML = (value) => String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
const tagValue = (block, tag) => decodeXML((block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')) || [])[1]);
const buildDailyFeed = async (url) => {
  const parsed = new URL(url, 'http://localhost');
  let lat = Number(parsed.searchParams.get('lat')) || 40.7128;
  let lon = Number(parsed.searchParams.get('lon')) || -74.006;
  let location = parsed.searchParams.get('location') || 'Your location';
  const city = String(parsed.searchParams.get('city') || '').trim().slice(0, 80);
  if (city) {
    try {
      const geocoded = JSON.parse(await fetchText(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`));
      const match = geocoded.results?.[0];
      if (match) { lat = Number(match.latitude); lon = Number(match.longitude); location = [match.name, match.country_code].filter(Boolean).join(', '); }
    } catch { /* Keep the last valid coordinates when geocoding is unavailable. */ }
  }
  const feeds = [
    ['world', 'https://feeds.bbci.co.uk/news/world/rss.xml', 'BBC World'],
    ['technology', 'https://feeds.bbci.co.uk/news/technology/rss.xml', 'BBC Technology'],
    ['business', 'https://feeds.bbci.co.uk/news/business/rss.xml', 'BBC Business'],
    ['culture', 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', 'BBC Culture'],
    ['sport', 'https://feeds.bbci.co.uk/sport/rss.xml', 'BBC Sport'],
  ];
  const [weatherRaw, ...newsRaws] = await Promise.all([
    fetchText(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`),
    ...feeds.map(([, feed]) => fetchText(feed).catch(() => '')),
  ]);
  const weatherJSON = JSON.parse(weatherRaw);
  const items = newsRaws.flatMap((newsRaw, feedIndex) => [...newsRaw.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 5).map((match) => {
    const block = match[1]; const [category, , source] = feeds[feedIndex];
    const rawDate = tagValue(block, 'pubDate');
    return { title: tagValue(block, 'title'), description: tagValue(block, 'description').slice(0, 180), link: tagValue(block, 'link'), source, category, publishedLabel: rawDate ? new Date(rawDate).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : 'Today' };
  })).filter((item) => item.title && item.link).filter((item, index, all) => all.findIndex((candidate) => candidate.link === item.link) === index).slice(0, 20);
  return { day: new Date().toISOString(), weather: { location, current: { temperature: weatherJSON.current.temperature_2m, apparent: weatherJSON.current.apparent_temperature, humidity: weatherJSON.current.relative_humidity_2m, code: weatherJSON.current.weather_code, wind: weatherJSON.current.wind_speed_10m }, today: { high: weatherJSON.daily.temperature_2m_max[0], low: weatherJSON.daily.temperature_2m_min[0] } }, news: items };
};

const server = http.createServer((request, response) => {
  const requestPath = request.url === '/' ? '/index.html' : request.url.split('?')[0];
  if (requestPath === '/api/youtube/search') {
    handleYouTubeSearch(request, response).catch(() => {
      if (!response.headersSent) {
        response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify({ error: { code: 'upstream_unavailable', message: 'YouTube search is temporarily unavailable.' } }));
      }
    });
    return;
  }
  if (requestPath === '/api/vip/live') {
    handleVipLive(request, response).catch(() => {
      if (!response.headersSent) {
        response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify({ error: { code: 'vip_service_unavailable', message: 'VIP access verification is temporarily unavailable.' } }));
      }
    });
    return;
  }
  if (requestPath === '/api/daily-feed') {
    buildDailyFeed(request.url).then((payload) => {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(payload));
    }).catch(() => {
      response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ error: 'Daily sources unavailable' }));
    });
    return;
  }
  const relativePath = requestPath === '/manus-routes.json'
    ? path.join('public', 'manus-routes.json')
    : (routeFiles[requestPath] || requestPath.replace(/^\//, ''));
  const filePath = path.resolve(root, relativePath);

  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }
    const contentType = types[path.extname(filePath)] || 'application/octet-stream';
    if (path.extname(filePath) === '.mp4') {
      const range = request.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
        const size = data.length;
        let start; let end;
        if (match && !match[1] && match[2]) {
          const suffixLength = Number(match[2]);
          start = Math.max(size - suffixLength, 0);
          end = size - 1;
        } else if (match && match[1]) {
          start = Number(match[1]);
          end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
        }
        if (!match || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
          response.writeHead(416, { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes */${size}` });
          response.end();
          return;
        }
        const partialData = data.subarray(start, end + 1);
        response.writeHead(206, {
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': partialData.length,
        });
        response.end(partialData);
        return;
      }
      response.writeHead(200, { 'Content-Type': contentType, 'Accept-Ranges': 'bytes', 'Content-Length': data.length });
      response.end(data);
      return;
    }
    response.writeHead(200, { 'Content-Type': contentType });
    response.end(data);
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`IQZodiac preview listening on port ${port}`);
});
