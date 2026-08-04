import { promises as fs } from 'node:fs';
import path from 'node:path';
import { importAppPackage } from '../src/lib/app-registry.js';

const [, , zipArg] = process.argv;

if (!zipArg) {
  console.error('Usage: node scripts/import-app-package.mjs <package-zip>');
  process.exit(1);
}

const zipPath = path.resolve(zipArg);
const buffer = await fs.readFile(zipPath);
const { appRecord } = await importAppPackage(buffer);

console.log(`Imported ${appRecord.name}`);
console.log(`Detail: /apps/${appRecord.slug}`);
console.log(`Launch: ${appRecord.launchUrl}`);
