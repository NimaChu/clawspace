import '../src/lib/env.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import {
  RUNTIME_DATA_DIR,
  RUNTIME_DIR,
  RUNTIME_APP_DOWNLOADS_DIR,
  RUNTIME_HOSTED_APPS_DIR,
} from '../src/lib/platform-paths.js';

const DATABASE_URL = process.env.DATABASE_URL?.trim() || '';
const DATABASE_SSL_MODE = process.env.DATABASE_SSL_MODE?.trim() || 'require';
const OBJECT_STORAGE_INDEX_PATH = path.join(RUNTIME_DATA_DIR, 'object-storage-index.json');
const MIGRATION_REPORT_PATH = path.join(RUNTIME_DATA_DIR, 'runtime-migration-report.json');
const OBJECT_FETCH_CONCURRENCY = Number(process.env.MIGRATION_OBJECT_FETCH_CONCURRENCY || 8);
const OBJECT_FETCH_TIMEOUT_MS = Number(process.env.MIGRATION_OBJECT_FETCH_TIMEOUT_MS || 20000);
const OBJECT_FETCH_RETRIES = Number(process.env.MIGRATION_OBJECT_FETCH_RETRIES || 3);
const OBJECT_FETCH_RETRY_ONLY_FAILED = process.env.MIGRATION_OBJECT_FETCH_RETRY_ONLY_FAILED === '1';

function createPool() {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is required to migrate remote runtime data.');
  }

  return new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_SSL_MODE === 'disable' ? false : { rejectUnauthorized: false },
  });
}

function ensureSafeRelativePath(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.split('/').includes('..')) {
    throw new Error(`Unsafe runtime path: ${relativePath}`);
  }
  return normalized;
}

async function ensureRuntimeDirs() {
  await Promise.all([
    fs.mkdir(RUNTIME_DIR, { recursive: true }),
    fs.mkdir(RUNTIME_DATA_DIR, { recursive: true }),
    fs.mkdir(RUNTIME_HOSTED_APPS_DIR, { recursive: true }),
    fs.mkdir(RUNTIME_APP_DOWNLOADS_DIR, { recursive: true }),
  ]);
}

async function writeRuntimeFile(relativePath, buffer) {
  const safePath = ensureSafeRelativePath(relativePath);
  const filePath = path.join(RUNTIME_DIR, safePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
}

async function exportDatabaseRuntimeFiles() {
  const pool = createPool();
  try {
    const result = await pool.query(
      'SELECT path, content, updated_at FROM runtime_files ORDER BY path ASC'
    );

    let exportedCount = 0;
    for (const row of result.rows) {
      await writeRuntimeFile(row.path, row.content);
      exportedCount += 1;
    }

    return {
      exportedCount,
      paths: result.rows.map((row) => row.path),
    };
  } finally {
    await pool.end();
  }
}

function resolveObjectStoragePath(relativePath) {
  const safePath = ensureSafeRelativePath(relativePath);

  if (safePath.startsWith('hosted-apps/')) {
    return path.join(RUNTIME_HOSTED_APPS_DIR, safePath.slice('hosted-apps/'.length));
  }

  if (safePath.startsWith('downloads/')) {
    return path.join(RUNTIME_APP_DOWNLOADS_DIR, safePath.slice('downloads/'.length));
  }

  throw new Error(`Unsupported object storage path: ${relativePath}`);
}

async function readObjectStorageIndex() {
  try {
    const raw = await fs.readFile(OBJECT_STORAGE_INDEX_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && parsed.files && typeof parsed.files === 'object'
      ? parsed
      : { files: {} };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { files: {} };
    }
    throw error;
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeMigrationReport(report) {
  await fs.writeFile(MIGRATION_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function readMigrationReport() {
  try {
    const raw = await fs.readFile(MIGRATION_REPORT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function fetchObject(sourceUrl) {
  const response = await fetch(sourceUrl, {
    signal: AbortSignal.timeout(OBJECT_FETCH_TIMEOUT_MS),
  });
  return response;
}

async function downloadObjectStorageFiles(index) {
  let entries = Object.entries(index.files || {});
  if (OBJECT_FETCH_RETRY_ONLY_FAILED) {
    const previousReport = await readMigrationReport();
    const failedPaths = new Set(
      (previousReport?.objectStorage?.failed || []).map((item) => item.relativePath).filter(Boolean)
    );
    entries = entries.filter(([relativePath]) => failedPaths.has(relativePath));
  }

  let downloadedCount = 0;
  let existingCount = 0;
  const skippedNoSource = [];
  const failed = [];

  let cursor = 0;

  async function worker() {
    while (cursor < entries.length) {
      const currentIndex = cursor;
      cursor += 1;

      const [relativePath, metadata] = entries[currentIndex];
      const sourceUrl = String(metadata?.url || metadata?.downloadUrl || '').trim();
      if (!sourceUrl) {
        skippedNoSource.push(relativePath);
        continue;
      }

      const targetPath = resolveObjectStoragePath(relativePath);
      if (await exists(targetPath)) {
        existingCount += 1;
        continue;
      }

      let lastFailure = null;

      for (let attempt = 1; attempt <= OBJECT_FETCH_RETRIES; attempt += 1) {
        try {
          const response = await fetchObject(sourceUrl);
          if (!response.ok) {
            lastFailure = {
              relativePath,
              sourceUrl,
              status: response.status,
              statusText: response.statusText,
              attempt,
            };
            continue;
          }

          await fs.mkdir(path.dirname(targetPath), { recursive: true });
          await fs.writeFile(targetPath, Buffer.from(await response.arrayBuffer()));
          downloadedCount += 1;
          lastFailure = null;
          break;
        } catch (error) {
          lastFailure = {
            relativePath,
            sourceUrl,
            message: String(error?.message || error),
            attempt,
          };
        }
      }

      if (lastFailure) {
        failed.push(lastFailure);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(OBJECT_FETCH_CONCURRENCY, entries.length) }, () => worker())
  );

  return {
    totalIndexedCount: entries.length,
    downloadedCount,
    existingCount,
    skippedNoSource,
    failed,
  };
}

async function main() {
  console.log('Starting runtime migration into local filesystem...');
  await ensureRuntimeDirs();

  if (!DATABASE_URL) {
    console.error('DATABASE_URL is empty. Add it to .env.local temporarily, then rerun this script.');
    process.exitCode = 1;
    return;
  }

  const dbSummary = await exportDatabaseRuntimeFiles();
  console.log(`Exported ${dbSummary.exportedCount} runtime data file(s) from Postgres.`);

  const objectStorageIndex = await readObjectStorageIndex();
  const fileCount = Object.keys(objectStorageIndex.files || {}).length;
  if (fileCount === 0) {
    console.log('No object-storage index found in runtime/data. Skipping hosted-app/download sync.');
    return;
  }

  const objectSummary = await downloadObjectStorageFiles(objectStorageIndex);
  const report = {
    generatedAt: new Date().toISOString(),
    options: {
      objectFetchConcurrency: OBJECT_FETCH_CONCURRENCY,
      objectFetchTimeoutMs: OBJECT_FETCH_TIMEOUT_MS,
      objectFetchRetries: OBJECT_FETCH_RETRIES,
      retryOnlyFailed: OBJECT_FETCH_RETRY_ONLY_FAILED,
    },
    database: {
      exportedCount: dbSummary.exportedCount,
    },
    objectStorage: {
      totalIndexedCount: objectSummary.totalIndexedCount,
      downloadedCount: objectSummary.downloadedCount,
      existingCount: objectSummary.existingCount,
      skippedNoSourceCount: objectSummary.skippedNoSource.length,
      failedCount: objectSummary.failed.length,
      skippedNoSource: objectSummary.skippedNoSource,
      failed: objectSummary.failed,
    },
  };
  await writeMigrationReport(report);

  console.log(`Downloaded ${objectSummary.downloadedCount} object-storage file(s) into runtime/.`);
  if (objectSummary.existingCount > 0) {
    console.log(`Kept ${objectSummary.existingCount} existing local object file(s).`);
  }
  if (objectSummary.skippedNoSource.length > 0) {
    console.log(`Skipped ${objectSummary.skippedNoSource.length} indexed file(s) without a source URL.`);
  }
  if (objectSummary.failed.length > 0) {
    console.log(`Could not fetch ${objectSummary.failed.length} object file(s). See ${MIGRATION_REPORT_PATH}.`);
  }
}

main().catch((error) => {
  console.error('Runtime migration failed.');
  console.error(error);
  process.exitCode = 1;
});
