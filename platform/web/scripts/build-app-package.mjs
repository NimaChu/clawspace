import { promises as fs } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const [, , packageSourceArg, appDirArg, outputArg] = process.argv;

if (!packageSourceArg || !appDirArg || !outputArg) {
  console.error('Usage: node scripts/build-app-package.mjs <package-source-dir> <app-build-dir> <output-zip>');
  process.exit(1);
}

const packageSourceDir = path.resolve(packageSourceArg);
const appBuildDir = path.resolve(appDirArg);
const outputPath = path.resolve(outputArg);

async function addDirectoryToZip(zip, baseDir, zipPrefix) {
  const entries = await fs.readdir(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    const filePath = path.join(baseDir, entry.name);
    const zipPath = `${zipPrefix}/${entry.name}`;

    if (entry.isDirectory()) {
      await addDirectoryToZip(zip, filePath, zipPath);
    } else if (entry.isFile()) {
      zip.file(zipPath, await fs.readFile(filePath));
    }
  }
}

const manifestPath = path.join(packageSourceDir, 'manifest.json');
const manifestRaw = await fs.readFile(manifestPath, 'utf8');
const manifest = JSON.parse(manifestRaw);
const builtEntryPath = path.join(appBuildDir, manifest.entry.replace(/^app\//, ''));

await fs.access(builtEntryPath);

const zip = new JSZip();
zip.file('manifest.json', manifestRaw);

const readmePath = path.join(packageSourceDir, 'README.md');
try {
  zip.file('README.md', await fs.readFile(readmePath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const assetsDir = path.join(packageSourceDir, 'assets');
try {
  await fs.access(assetsDir);
  await addDirectoryToZip(zip, assetsDir, 'assets');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

await addDirectoryToZip(zip, appBuildDir, 'app');
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

console.log(`Package written to ${outputPath}`);
