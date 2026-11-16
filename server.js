const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// In-memory memory cache for ultra-fast static file delivery
const memoryCache = new Map();

function preloadStaticAssets() {
  const dirFiles = fs.readdirSync(__dirname);
  for (const file of dirFiles) {
    const ext = path.extname(file).toLowerCase();
    // Cache static assets (images, fonts, scripts) in RAM; keep HTML dynamic
    if (ext && ext !== '.html' && MIME_TYPES[ext]) {
      const fullPath = path.join(__dirname, file);
      try {
        const data = fs.readFileSync(fullPath);
        memoryCache.set('/' + file.toLowerCase(), {
          data,
          contentType: MIME_TYPES[ext],
          size: data.length
        });
      } catch (e) {
        // skip if unreadable
      }
    }
  }
}

preloadStaticAssets();

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const ext = path.extname(reqPath).toLowerCase();

  // Serve static files from memory cache if available
  const cached = memoryCache.get(reqPath.toLowerCase());
  if (cached && ext !== '.html') {
    res.writeHead(200, {
      'Content-Type': cached.contentType,
      'Content-Length': cached.size,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN'
    });
    res.end(cached.data);
    return;
  }

  const filePath = path.join(__dirname, reqPath);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN'
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}/ (in-memory cached)`);
});
