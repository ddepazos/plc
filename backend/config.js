import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));
export function config(env = process.env) {
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT inválido');
  const host = env.HOST || '127.0.0.1';
  if (!['127.0.0.1', '0.0.0.0'].includes(host)) throw new Error('HOST inválido; usa 127.0.0.1 o 0.0.0.0');
  const rawOrigin = env.PUBLIC_ORIGIN || env.RENDER_EXTERNAL_URL;
  let publicOrigin = null;
  if (rawOrigin) {
    let url;
    try { url = new URL(rawOrigin); }
    catch { throw new Error('PUBLIC_ORIGIN inválido'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('PUBLIC_ORIGIN debe ser un origen HTTPS sin ruta, credenciales ni parámetros');
    }
    publicOrigin = url.origin;
  }
  const demoPassword = env.PLC_DEMO_PASSWORD || null;
  const databaseUrl = env.DATABASE_URL || null;
  if (host === '0.0.0.0' && !publicOrigin) throw new Error('PUBLIC_ORIGIN o RENDER_EXTERNAL_URL es obligatorio con HOST=0.0.0.0');
  if (host === '0.0.0.0' && (!demoPassword || demoPassword.length < 16)) {
    throw new Error('PLC_DEMO_PASSWORD de al menos 16 caracteres es obligatorio con HOST=0.0.0.0');
  }
  if (host === '0.0.0.0' && !databaseUrl) throw new Error('DATABASE_URL es obligatorio con HOST=0.0.0.0 para evitar datos efímeros');
  return {
    host, port, publicOrigin, demoPassword,
    databaseUrl,
    storeFile: env.PLC_DATA_FILE ? path.resolve(env.PLC_DATA_FILE) : path.join(root, 'backend/storage/demo.json'),
    seedFile: path.join(root, 'data/plc-demo.json'),
    maxBodyBytes: 8192
  };
}
