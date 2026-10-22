const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT || 3000);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const routeFiles = {
  '/profile': 'profile.html',
  '/home': 'home.html',
  '/signup': 'signup.html',
  '/discover': 'discover.html',
  '/rooms': 'rooms.html',
  '/messages': 'messages.html',
  '/match': 'match.html',
  '/daily': 'daily.html',
};
const fetchText = (url) => new Promise((resolve, reject) => {
  https.get(url, { headers: { 'User-Agent': 'IQZodiac Daily/1.0' } }, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => res.statusCode >= 200 && res.statusCode < 300 ? resolve(body) : reject(new Error(`Upstream ${res.statusCode}`)));
  }).on('error', reject);
});
const decodeXML = (value) => String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
const tagValue = (block, tag) => decodeXML((block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')) || [])[1]);
const buildDailyFeed = async (url) => {
  const parsed = new URL(url, 'http://localhost');
  const lat = Number(parsed.searchParams.get('lat')) || 40.7128;
  const lon = Number(parsed.searchParams.get('lon')) || -74.006;
  const location = parsed.searchParams.get('location') || 'Your location';
  const [weatherRaw, newsRaw] = await Promise.all([
    fetchText(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`),
    fetchText('https://feeds.bbci.co.uk/news/rss.xml'),
  ]);
  const weatherJSON = JSON.parse(weatherRaw);
  const items = [...newsRaw.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 8).map((match) => {
    const block = match[1];
    const rawDate = tagValue(block, 'pubDate');
    return { title: tagValue(block, 'title'), description: tagValue(block, 'description').slice(0, 180), link: tagValue(block, 'link'), source: 'BBC News', publishedLabel: rawDate ? new Date(rawDate).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : 'Today' };
  }).filter((item) => item.title && item.link);
  return { day: new Date().toISOString(), weather: { location, current: { temperature: weatherJSON.current.temperature_2m, apparent: weatherJSON.current.apparent_temperature, humidity: weatherJSON.current.relative_humidity_2m, code: weatherJSON.current.weather_code, wind: weatherJSON.current.wind_speed_10m }, today: { high: weatherJSON.daily.temperature_2m_max[0], low: weatherJSON.daily.temperature_2m_min[0] } }, news: items };
};

const server = http.createServer((request, response) => {
  const requestPath = request.url === '/' ? '/index.html' : request.url.split('?')[0];
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
    response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
    response.end(data);
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`IQZodiac preview listening on port ${port}`);
});
