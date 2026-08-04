import { existsSync, readFileSync } from 'node:fs';
import { config as loadEnv, parse as parseEnv } from 'dotenv';

const shellDefinedKeys = new Set(Object.keys(process.env));

loadEnv();

if (existsSync('.env.local')) {
  const parsed = parseEnv(readFileSync('.env.local'));
  for (const [key, value] of Object.entries(parsed)) {
    // Let .env.local override .env, but never clobber explicit shell env overrides.
    if (!shellDefinedKeys.has(key)) {
      process.env[key] = value;
    }
  }
}
