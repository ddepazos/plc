import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));

function csv(value = '') {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

export function config(env = process.env) {
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT inválido');
  const production = env.NODE_ENV === 'production';
  return {
    host: env.HOST || (production ? '0.0.0.0' : '127.0.0.1'),
    port,
    production,
    databaseUrl: env.DATABASE_URL || null,
    allowedOrigins: csv(env.ALLOWED_ORIGINS),
    storeFile: env.PLC_DATA_FILE ? path.resolve(env.PLC_DATA_FILE) : path.join(root, 'backend/storage/demo.json'),
    seedFile: path.join(root, 'data/plc-demo.json'),
    maxBodyBytes: 8192
  };
}
