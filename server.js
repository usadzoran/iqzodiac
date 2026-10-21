const http = require('http');
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

const server = http.createServer((request, response) => {
  const requestPath = request.url === '/' ? '/index.html' : request.url.split('?')[0];
  const relativePath = requestPath === '/manus-routes.json'
    ? path.join('public', 'manus-routes.json')
    : requestPath === '/profile'
      ? 'profile.html'
    : requestPath === '/home'
        ? 'home.html'
      : requestPath === '/signup'
        ? 'signup.html'
      : requestPath === '/discover'
        ? 'discover.html'
      : requestPath.replace(/^\//, '');
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
