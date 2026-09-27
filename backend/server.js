import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config, root } from './config.js';
import { createStore } from './services/store.js';
import { api } from './routes/api.js';
import { ApiError } from './models/transaction.js';

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
function authorized(req, expectedDigest) {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || header.length > 2048) return false;
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/.exec(header);
  if (!match) return false;
  const digest = createHash('sha256').update(Buffer.from(match[1], 'base64')).digest();
  return timingSafeEqual(digest, expectedDigest);
}
function safeErrorCode(error) {
  return typeof error?.code === 'string' && /^[A-Z0-9_]{3,20}$/.test(error.code) ? ` (${error.code})` : '';
}
export async function createApp(settings = config()) {
  if (settings.host === '0.0.0.0' && (!settings.publicOrigin || !settings.demoPassword)) {
    throw new Error('El servidor público requiere PUBLIC_ORIGIN y PLC_DEMO_PASSWORD.');
  }
  const publicHost = settings.publicOrigin && new URL(settings.publicOrigin).host;
  const expectedDigest = settings.demoPassword
    ? createHash('sha256').update(`demo:${settings.demoPassword}`).digest()
    : null;
  // El modo JSON funciona sin instalar pg; PostgreSQL se carga sólo si se configura.
  const store = settings.databaseUrl
    ? await (await import('./services/postgres-store.js')).createPostgresStore(settings)
    : await createStore(settings);
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      const host = req.headers.host;
      const port = res.socket.localPort;
      const publicServer = settings.host === '0.0.0.0';
      const hostAllowed = publicServer ? host === publicHost : [`127.0.0.1:${port}`, `localhost:${port}`].includes(host);
      if (!hostAllowed) throw new ApiError(403, 'Host no permitido.');
      const expectedOrigin = publicServer ? settings.publicOrigin : `http://${host}`;
      if (req.headers.origin && req.headers.origin !== expectedOrigin) throw new ApiError(403, 'Origen no permitido.');
      if (req.headers['sec-fetch-site'] === 'cross-site') throw new ApiError(403, 'Solicitud externa bloqueada.');
      const url = new URL(req.url, expectedOrigin);
      if (url.origin !== expectedOrigin) throw new ApiError(403, 'URL no permitida.');
      if (expectedDigest && !(req.method === 'GET' && url.pathname === '/api/health') && !authorized(req, expectedDigest)) {
        res.setHeader('WWW-Authenticate', 'Basic realm="PLC Demo", charset="UTF-8"');
        throw new ApiError(401, 'Acceso demo requerido.');
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
      if (!error.status) console.error(`PLC DEMO: error interno${safeErrorCode(error)}.`);
    }
  });
  server.on('close', () => { if (store.close) void store.close().catch(console.error); });
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let settings;
  try { settings = config(); }
  catch (error) { console.error(`PLC DEMO: ${error.message}`); process.exitCode = 1; }
  if (settings) {
    try {
      const server = await createApp(settings);
      server.listen(settings.port, settings.host, () => {
        const address = settings.host === '0.0.0.0' ? settings.publicOrigin : `http://${settings.host}:${server.address().port}`;
        console.log(`PLC DEMO: ${address} · persistencia ${settings.databaseUrl ? 'PostgreSQL' : 'JSON'} · sin dinero real`);
      });
    } catch (error) {
      console.error(`PLC DEMO: no se pudo iniciar la persistencia${safeErrorCode(error)}. Verifica DATABASE_URL y ejecuta la migración antes del arranque.`);
      process.exitCode = 1;
    }
  }
}
