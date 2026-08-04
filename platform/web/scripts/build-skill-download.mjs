import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  process.env.CLAWAPP_CREATOR_SOURCE,
  path.resolve(scriptDir, '../../../skills/clawapp-creator'),
  path.resolve(scriptDir, '../../clawapp-creator'),
].filter(Boolean);

async function isDirectory(candidate) {
  try {
    return (await fs.stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

const sourceDir = (await Promise.all(candidates.map(async candidate => (
  (await isDirectory(candidate)) ? candidate : null
)))).find(Boolean);

if (!sourceDir) {
  throw new Error('Unable to locate clawapp-creator. Set CLAWAPP_CREATOR_SOURCE to its directory.');
}

const outputPath = path.resolve(scriptDir, '../public/downloads/clawapp-creator.zip');
const excludedNames = new Set(['.git', '.github', '.DS_Store', '__pycache__']);
const zip = new JSZip();

async function addDirectory(directory, relative = '') {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (excludedNames.has(entry.name) || entry.name.endsWith('.pyc')) continue;
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) {
      await addDirectory(absolutePath, relativePath);
    } else if (entry.isFile()) {
      zip.file(path.posix.join('clawapp-creator', relativePath), await fs.readFile(absolutePath));
    }
  }
}

await addDirectory(sourceDir);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
}));

console.log(`Built ${outputPath} from ${sourceDir}`);
