import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import web from '../../src/index.js';
import requestStore from './request-store.cjs';

// Isolated Node/SQLite browser harness. No production binding, credential, AI or payment.
export async function startRequestPreview({adminToken,host='shop.yggmetro.com'} = {}) {
  const {db, env} = requestStore.fixture();
  // Explicit synthetic fixture only; never load a credential from the environment.
  if (adminToken) env.YGG_ADMIN_CREDENTIALS = JSON.stringify({fixture_admin: createHash('sha256').update(adminToken).digest('hex')});
  const assets = path.resolve('public');
  env.ASSETS = {async fetch(request) {
    const file = path.resolve(assets, '.' + new URL(request.url).pathname);
    if (!file.startsWith(assets + path.sep)) return new Response('Not Found', {status: 404});
    try {
      const type = {'.css':'text/css','.json':'application/json','.html':'text/html','.js':'text/javascript', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp'}[path.extname(file)] || 'application/octet-stream';
      return new Response(await fs.readFile(file), {headers: {'content-type': type}});
    } catch { return new Response('Not Found', {status: 404}); }
  }};
  let origin;
  const server = http.createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const headers = new Headers(req.headers);
      if (headers.get('origin') === origin) headers.set('origin', 'https://'+host);
      const result = await web.fetch(new Request('https://'+host + req.url, {
        method: req.method, headers,
        ...(!['GET', 'HEAD'].includes(req.method) ? {body: Buffer.concat(chunks)} : {}),
      }), env);
      res.writeHead(result.status, Object.fromEntries(result.headers));
      res.end(Buffer.from(await result.arrayBuffer()));
    } catch (error) { res.writeHead(500); res.end('Local fixture error: ' + error.message); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  return {origin, db, async close() {
    await new Promise(resolve => server.close(resolve));
    db.close();
  }};
}
