// routes/stream.js
const express = require('express');
const http = require('http');
const https = require('https');
const { pipeline } = require('stream');
const { URL } = require('url');

const router = express.Router();

const d64 = s => Buffer.from(s, 'base64url').toString('utf8');
const e64 = s => Buffer.from(s, 'utf8').toString('base64url');
const clientFor = u => u.startsWith('https:') ? https : http;

router.get('/b64/:encoded', (req, res) => {
  let target;
  try { target = d64(req.params.encoded); }
  catch { return res.status(400).send('Bad encoded url'); }

  const isM3U8 = target.toLowerCase().includes('.m3u8');

  // Jangan cache
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const c = clientFor(target);
  const up = c.get(target, (ur) => {
    const ctype = (ur.headers['content-type'] || '').toLowerCase();
    const asM3U8 = isM3U8 || ctype.includes('application/vnd.apple.mpegurl') || ctype.includes('application/x-mpegurl');

    if (asM3U8) {
      let text = '';
      ur.setEncoding('utf8');
      ur.on('data', chunk => text += chunk);
      ur.on('end', () => {
        try {
          const base = new URL(target);
          const rewriteAbs = (s) => `/stream/b64/${e64(new URL(s, base).href)}`;

          const lines = text.split('\n').map((line) => {
            const L = line.trim();

            // Baris komentar selain KEY/MAP → biarkan
            if (L.startsWith('#')) {
              // Rewrite URI= di KEY / SESSION-KEY / MAP
              if (/^#EXT-X-(SESSION-)?KEY/.test(L) || /^#EXT-X-MAP/.test(L)) {
                return line.replace(/URI="([^"]+)"/g, (_, uri) => {
                  const prox = rewriteAbs(uri);
                  return `URI="${prox}"`;
                });
              }
              return line;
            }

            // Baris URL (variant playlist/segment)
            if (!L) return line;
            const prox = rewriteAbs(L);
            return prox;
          });

          res.status(ur.statusCode || 200);
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
          res.end(lines.join('\n'), 'utf8');
        } catch (e) {
          res.status(502).send('Playlist rewrite error');
        }
      });
      ur.on('error', () => res.status(502).send('Upstream error'));
      return;
    }

    // Selain M3U8: segmen TS/M4S/JPEG/MJPEG → langsung pipe
    res.status(ur.statusCode || 200);
    for (const [k, v] of Object.entries(ur.headers)) {
      if (typeof v !== 'undefined') res.setHeader(k, v);
    }
    pipeline(ur, res, (err) => {
      if (err && !res.headersSent) res.status(502).end('Bad gateway');
    });
  });

  up.setTimeout(30000, () => up.destroy(new Error('Upstream timeout')));
  up.on('error', () => { if (!res.headersSent) res.status(502).send('Upstream error'); });
  req.on('close', () => up.destroy());
});

module.exports = router;
