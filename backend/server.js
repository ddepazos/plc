import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config, root } from './config.js';
import { createStore } from './services/store.js';
import { api } from './routes/api.js';
import { ApiError } from './models/transaction.js';

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };

function requestOrigin(req) {
  if (!req.headers.origin) return null;
  try { return new URL(req.headers.origin).origin; }
  catch { throw new ApiError(403, 'Origen inválido.'); }
}

function validateRequest(req, settings, port) {
  const host = req.headers.host;
  if (!host) throw new ApiError(400, 'Host requerido.');
  if (!settings.production) {
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(host)) throw new ApiError(403, 'Host no permitido.');
    if (req.headers.origin && req.headers.origin !== `http://${host}`) throw new ApiError(403, 'Origen no permitido.');
    if (req.headers['sec-fetch-site'] === 'cross-site') throw new ApiError(403, 'Solicitud externa bloqueada.');
    return;
  }
  const origin = requestOrigin(req);
  if (origin && settings.allowedOrigins.length && !settings.allowedOrigins.includes(origin)) throw new ApiError(403, 'Origen no permitido.');
}

function applyCors(req, res, settings) {
  if (!settings.production || !req.headers.origin) return;
  const origin = requestOrigin(req);
  if (settings.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
}

export async function createApp(settings = config()) {
  const store = settings.databaseUrl
    ? await (await import('./services/postgres-store.js')).createPostgresStore(settings)
    : await createStore(settings);
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      const port = res.socket.localPort;
      validateRequest(req, settings, port);
      applyCors(req, res, settings);
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }
      const host = req.headers.host;
      const url = new URL(req.url, `http://${host}`);
      if (url.pathname === '/health') {
        res.setHeader('Content-Type', mime['.json']);
        res.end(JSON.stringify({ ok: true, storage: settings.databaseUrl ? 'postgresql' : 'json' }));
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        const result = await api(req, url.pathname, store, settings);
        res.setHeader('Content-Type', mime['.json']);
        res.end(JSON.stringify(result));
        return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw new ApiError(405, 'Método no permitido.');
      const name = url.pathname === '/' ? '/index.html' : url.pathname;
      if (!/^\/(index\.html|pages\/[a-z]+\.html|assets\/(css|js)\/[a-z-]+\.(css|js)|data\/plc-demo\.json)$/.test(name)) throw new ApiError(404, 'Archivo no encontrado.');
      let content;
      try { content = await readFile(path.join(root, name)); }
      catch (error) { if (error.code === 'ENOENT') throw new ApiError(404, 'Archivo no encontrado.'); throw error; }
      res.setHeader('Content-Type', mime[path.extname(name)]);
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      res.statusCode = error.status || 500;
      res.setHeader('Content-Type', mime['.json']);
      res.end(JSON.stringify({ error: error.status ? error.message : 'Error interno; no se confirmó la operación.' }));
      if (!error.status) console.error(error);
    }
  });
  server.on('close', () => { if (store.close) void store.close().catch(console.error); });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const settings = config();
  const server = await createApp(settings);
  server.listen(settings.port, settings.host, () => console.log(`PLC DEMO: http://${settings.host}:${server.address().port} · persistencia ${settings.databaseUrl ? 'PostgreSQL' : 'JSON'} · sin dinero real`));
}
