import { existsSync, readFileSync } from 'node:fs';
import { config as loadEnv, parse as parseEnv } from 'dotenv';
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

const shellDefinedKeys = new Set(Object.keys(process.env));

loadEnv();

if (existsSync('.env.local')) {
  const parsed = parseEnv(readFileSync('.env.local'));
  for (const [key, value] of Object.entries(parsed)) {
    if (!shellDefinedKeys.has(key)) {
      process.env[key] = value;
    }
  }
}

const siteUrl = process.env.SITE_URL?.trim() || process.env.PUBLIC_SITE_URL?.trim() || 'https://nima-tech.space';

// https://astro.build/config
export default defineConfig({
  site: siteUrl,
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [],
  markdown: {
    syntaxHighlight: 'prism',
    remarkPlugins: [],
    rehypePlugins: [],
  },
  vite: {
    resolve: {
      alias: {
        '@': '/src'
      }
    }
  }
});
