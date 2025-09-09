// routes/stream.js
const express = require('express');
const http = require('http');
const https = require('https');
const { pipeline } = require('stream');
const { URL } = require('url');

const router = express.Router();

function decodeB64Url(s) {
  return Buffer.from(s, 'base64url').toString('utf8');
}
function encodeB64Url(s) {
  return Buffer.from(s, 'utf8').toString('base64url');
}
function httpClientFor(urlStr) {
  return urlStr.startsWith('https:') ? https : http;
}

router.get('/b64/:encoded', (req, res) => {
  let target;
  try {
    target = decodeB64Url(req.params.encoded);
  } catch {
    return res.status(400).send('Bad encoded url');
  }

  const isM3U8 = target.toLowerCase().includes('.m3u8');

  // No-cache headers (biar benar2 live)
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const client = httpClientFor(target);
  const upstreamReq = client.get(target, (upRes) => {
    const ctype = (upRes.headers['content-type'] || '').toLowerCase();

    // Case 1: HLS playlist → rewrite
    if (isM3U8 || ctype.includes('application/vnd.apple.mpegurl') || ctype.includes('application/x-mpegurl')) {
      let data = '';
      upRes.setEncoding('utf8');
      upRes.on('data', (chunk) => (data += chunk));
      upRes.on('end', () => {
        try {
          const base = new URL(target);
          const lines = data.split('\n').map((line) => {
            const trimmed = line.trim();
            // HLS: baris URL adalah baris yang bukan komentar (#)
            if (!trimmed || trimmed.startsWith('#')) return line;

            // Buat URL absolut relatif ke playlist source
            const abs = new URL(trimmed, base).href;
            // Bungkus pakai proxy lagi
            const prox = `/stream/b64/${encodeB64Url(abs)}`;
            return prox;
          });
          const body = lines.join('\n');
          res.status(upRes.statusCode || 200);
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
          res.end(body, 'utf8');
        } catch (e) {
          res.status(502).send('Playlist rewrite error');
        }
      });
      upRes.on('error', () => res.status(502).send('Upstream error'));
      return;
    }

    // Case 2: MJPEG / JPEG / HLS segments / lainnya → langsung pipa
    res.status(upRes.statusCode || 200);
    // Teruskan header penting (cth boundary MJPEG, content-type, content-length jika ada)
    for (const [k, v] of Object.entries(upRes.headers)) {
      if (typeof v !== 'undefined') res.setHeader(k, v);
    }
    pipeline(upRes, res, (err) => {
      if (err && !res.headersSent) res.status(502).end('Bad gateway');
    });
  });

  upstreamReq.setTimeout(30000, () => upstreamReq.destroy(new Error('Upstream timeout')));
  upstreamReq.on('error', () => {
    if (!res.headersSent) res.status(502).send('Upstream error');
  });
  req.on('close', () => upstreamReq.destroy());
});

module.exports = router;
