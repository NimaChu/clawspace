import './env.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { RUNTIME_DIR } from './platform-paths.js';

const DATABASE_URL = process.env.DATABASE_URL?.trim() || '';
const DATABASE_PATH_PREFIX = 'data/';

let pool;
let schemaReadyPromise;
let runtimeStorageDegraded = false;

export function isDatabaseQuotaExceededError(error) {
  const message = String(error?.message || '');
  return (
    error?.code === 'XX000' &&
    /exceeded the data transfer quota|upgrade your plan to increase limits/i.test(message)
  );
}

export function markRuntimeStorageDegraded() {
  runtimeStorageDegraded = true;
}

export function resetRuntimeStorageDegraded() {
  runtimeStorageDegraded = false;
}

export function wasRuntimeStorageDegraded() {
  return runtimeStorageDegraded;
}

function createPool() {
  if (!DATABASE_URL) {
    return null;
  }

  if (!pool) {
    const sslMode = process.env.DATABASE_SSL_MODE?.trim() || 'require';
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: sslMode === 'disable' ? false : { rejectUnauthorized: false },
    });
  }

  return pool;
}

async function ensureDatabaseSchema() {
  if (!DATABASE_URL) return;

  if (!schemaReadyPromise) {
    const db = createPool();
    schemaReadyPromise = db.query(`
      CREATE TABLE IF NOT EXISTS runtime_files (
        path TEXT PRIMARY KEY,
        content BYTEA NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  await schemaReadyPromise;
}

function useDatabase(relativePath) {
  const normalizedPath = String(relativePath || '');
  return Boolean(DATABASE_URL) && (normalizedPath === 'data' || normalizedPath.startsWith(DATABASE_PATH_PREFIX));
}

class FileSystemRuntimeStorage {
  constructor(rootDir) {
    this.rootDir = rootDir;
  }

  resolve(relativePath = '') {
    return path.join(this.rootDir, relativePath);
  }

  async ensureDir(relativePath = '') {
    await fs.mkdir(this.resolve(relativePath), { recursive: true });
  }

  async exists(relativePath) {
    try {
      await fs.access(this.resolve(relativePath));
      return true;
    } catch {
      return false;
    }
  }

  async readJson(relativePath, fallbackValue) {
    try {
      const raw = await fs.readFile(this.resolve(relativePath), 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === 'ENOENT' && fallbackValue !== undefined) {
        return fallbackValue;
      }

      throw error;
    }
  }

  async writeJson(relativePath, value) {
    const filePath = this.resolve(relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }

  async readText(relativePath, encoding = 'utf8') {
    return fs.readFile(this.resolve(relativePath), encoding);
  }

  async writeText(relativePath, value, encoding = 'utf8') {
    const filePath = this.resolve(relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, value, encoding);
  }

  async readBuffer(relativePath) {
    return fs.readFile(this.resolve(relativePath));
  }

  async writeBuffer(relativePath, value) {
    const filePath = this.resolve(relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, value);
  }

  async remove(relativePath, options = {}) {
    return fs.rm(this.resolve(relativePath), {
      recursive: Boolean(options.recursive),
      force: options.force !== false,
    });
  }
}

class DatabaseRuntimeStorage {
  async ensureDir() {}

  async exists(relativePath) {
    try {
      await ensureDatabaseSchema();
      const db = createPool();
      const result = await db.query('SELECT 1 FROM runtime_files WHERE path = $1 LIMIT 1', [relativePath]);
      return result.rowCount > 0;
    } catch (error) {
      if (isDatabaseQuotaExceededError(error)) {
        markRuntimeStorageDegraded();
        return false;
      }
      throw error;
    }
  }

  async readBuffer(relativePath) {
    try {
      await ensureDatabaseSchema();
      const db = createPool();
      const result = await db.query('SELECT content FROM runtime_files WHERE path = $1 LIMIT 1', [relativePath]);
      if (result.rowCount === 0) {
        const error = new Error(`No such file: ${relativePath}`);
        error.code = 'ENOENT';
        throw error;
      }

      return result.rows[0].content;
    } catch (error) {
      if (isDatabaseQuotaExceededError(error)) {
        markRuntimeStorageDegraded();
        const fallbackError = new Error(`No such file: ${relativePath}`);
        fallbackError.code = 'ENOENT';
        throw fallbackError;
      }
      throw error;
    }
  }

  async writeBuffer(relativePath, value) {
    await ensureDatabaseSchema();
    const db = createPool();
    await db.query(
      `INSERT INTO runtime_files (path, content, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (path)
       DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()`,
      [relativePath, value]
    );
  }

  async readText(relativePath, encoding = 'utf8') {
    const buffer = await this.readBuffer(relativePath);
    return buffer.toString(encoding);
  }

  async writeText(relativePath, value, encoding = 'utf8') {
    await this.writeBuffer(relativePath, Buffer.from(value, encoding));
  }

  async readJson(relativePath, fallbackValue) {
    try {
      const raw = await this.readText(relativePath, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === 'ENOENT' && fallbackValue !== undefined) {
        return fallbackValue;
      }

      throw error;
    }
  }

  async writeJson(relativePath, value) {
    await this.writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }

  async remove(relativePath, options = {}) {
    await ensureDatabaseSchema();
    const db = createPool();

    if (options.recursive) {
      await db.query('DELETE FROM runtime_files WHERE path = $1 OR path LIKE $2', [
        relativePath,
        `${relativePath}/%`,
      ]);
      return;
    }

    await db.query('DELETE FROM runtime_files WHERE path = $1', [relativePath]);
  }
}

class HybridRuntimeStorage {
  constructor(rootDir) {
    this.fileSystem = new FileSystemRuntimeStorage(rootDir);
    this.database = new DatabaseRuntimeStorage();
  }

  backend(relativePath) {
    return useDatabase(relativePath) ? this.database : this.fileSystem;
  }

  async ensureDir(relativePath = '') {
    return this.backend(relativePath).ensureDir(relativePath);
  }

  async exists(relativePath) {
    return this.backend(relativePath).exists(relativePath);
  }

  async readJson(relativePath, fallbackValue) {
    return this.backend(relativePath).readJson(relativePath, fallbackValue);
  }

  async writeJson(relativePath, value) {
    return this.backend(relativePath).writeJson(relativePath, value);
  }

  async readText(relativePath, encoding = 'utf8') {
    return this.backend(relativePath).readText(relativePath, encoding);
  }

  async writeText(relativePath, value, encoding = 'utf8') {
    return this.backend(relativePath).writeText(relativePath, value, encoding);
  }

  async readBuffer(relativePath) {
    return this.backend(relativePath).readBuffer(relativePath);
  }

  async writeBuffer(relativePath, value) {
    return this.backend(relativePath).writeBuffer(relativePath, value);
  }

  async remove(relativePath, options = {}) {
    return this.backend(relativePath).remove(relativePath, options);
  }
}

export function createRuntimeStorage() {
  return new HybridRuntimeStorage(RUNTIME_DIR);
}

export const runtimeStorage = createRuntimeStorage();
