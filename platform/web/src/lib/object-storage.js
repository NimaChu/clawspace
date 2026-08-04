import './env.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { del, head, list, put } from '@vercel/blob';
import { RUNTIME_APP_DOWNLOADS_DIR, RUNTIME_HOSTED_APPS_DIR } from './platform-paths.js';
import { runtimeStorage } from './runtime-storage.js';
import { getContentType } from './content-type.js';

const OBJECT_STORAGE_INDEX_PATH = 'data/object-storage-index.json';
const OBJECT_STORAGE_PROVIDER = process.env.OBJECT_STORAGE_PROVIDER?.trim() || '';
const BLOB_RW_TOKEN = process.env.BLOB_READ_WRITE_TOKEN?.trim() || '';

function shouldUseVercelBlob() {
  if (OBJECT_STORAGE_PROVIDER === 'filesystem') {
    return false;
  }

  if (OBJECT_STORAGE_PROVIDER === 'vercel-blob') {
    return true;
  }

  return Boolean(BLOB_RW_TOKEN);
}

function createNotFoundError(targetPath) {
  const error = new Error(`No such file: ${targetPath}`);
  error.code = 'ENOENT';
  return error;
}

function isSafeStoragePath(value) {
  const normalized = String(value || '');
  return Boolean(normalized) && !normalized.startsWith('/') && !normalized.includes('\\') && !normalized.split('/').includes('..');
}

function normalizeIndex(index) {
  if (!index || typeof index !== 'object') {
    return { files: {} };
  }

  return {
    files: typeof index.files === 'object' && index.files ? index.files : {},
  };
}

async function readObjectStorageIndex() {
  return normalizeIndex(await runtimeStorage.readJson(OBJECT_STORAGE_INDEX_PATH, { files: {} }));
}

async function writeObjectStorageIndex(index) {
  await runtimeStorage.writeJson(OBJECT_STORAGE_INDEX_PATH, normalizeIndex(index));
}

class FileSystemObjectStorage {
  resolve(relativePath) {
    if (!isSafeStoragePath(relativePath)) {
      throw new Error(`Invalid object storage path: ${relativePath}`);
    }

    if (relativePath.startsWith('hosted-apps/')) {
      return path.join(RUNTIME_HOSTED_APPS_DIR, relativePath.slice('hosted-apps/'.length));
    }

    if (relativePath.startsWith('downloads/')) {
      return path.join(RUNTIME_APP_DOWNLOADS_DIR, relativePath.slice('downloads/'.length));
    }

    throw new Error(`Unsupported object storage path: ${relativePath}`);
  }

  async writeBuffer(relativePath, buffer, options = {}) {
    const filePath = this.resolve(relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return {
      pathname: relativePath,
      contentType: options.contentType || getContentType(relativePath),
      url: null,
      downloadUrl: null,
    };
  }

  async readBuffer(relativePath) {
    return fs.readFile(this.resolve(relativePath));
  }

  async getMetadata(relativePath) {
    const filePath = this.resolve(relativePath);
    try {
      const stats = await fs.stat(filePath);
      return {
        pathname: relativePath,
        size: stats.size,
        contentType: getContentType(relativePath),
        url: null,
        downloadUrl: null,
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw createNotFoundError(relativePath);
      }

      throw error;
    }
  }

  async remove(relativePath) {
    await fs.rm(this.resolve(relativePath), { force: true });
  }

  async removePrefix(prefix) {
    const targetPath = this.resolve(prefix);
    await fs.rm(targetPath, { recursive: true, force: true });
  }
}

class VercelBlobObjectStorage {
  async writeBuffer(relativePath, buffer, options = {}) {
    const blob = await put(relativePath, buffer, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: options.contentType || getContentType(relativePath),
    });

    const index = await readObjectStorageIndex();
    index.files[relativePath] = {
      pathname: blob.pathname,
      url: blob.url,
      downloadUrl: blob.downloadUrl,
        contentType: blob.contentType || options.contentType || getContentType(relativePath),
        uploadedAt: new Date().toISOString(),
      };
    await writeObjectStorageIndex(index);

    return index.files[relativePath];
  }

  async getMetadata(relativePath) {
    const index = await readObjectStorageIndex();
    const cached = index.files[relativePath];
    if (cached?.url) {
      return cached;
    }

    try {
      const metadata = await head(relativePath);
      const normalized = {
        pathname: metadata.pathname,
        url: metadata.url,
        downloadUrl: metadata.downloadUrl,
        contentType: metadata.contentType || getContentType(relativePath),
        uploadedAt: metadata.uploadedAt ? new Date(metadata.uploadedAt).toISOString() : new Date().toISOString(),
      };
      index.files[relativePath] = normalized;
      await writeObjectStorageIndex(index);
      return normalized;
    } catch (error) {
      throw createNotFoundError(relativePath);
    }
  }

  async readBuffer(relativePath) {
    const metadata = await this.getMetadata(relativePath);
    const response = await fetch(metadata.url);
    if (!response.ok) {
      if (response.status === 404) {
        throw createNotFoundError(relativePath);
      }

      throw new Error(`Failed to read blob: ${relativePath}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  async remove(relativePath) {
    const index = await readObjectStorageIndex();
    const metadata = index.files[relativePath];
    await del(metadata?.url || relativePath);
    delete index.files[relativePath];
    await writeObjectStorageIndex(index);
  }

  async removePrefix(prefix) {
    const pathsToDelete = [];
    let cursor;
    let hasMore = true;

    while (hasMore) {
      const page = await list({ prefix, cursor, limit: 1000 });
      for (const blob of page.blobs) {
        pathsToDelete.push(blob.url);
      }
      hasMore = page.hasMore;
      cursor = page.cursor;
    }

    if (pathsToDelete.length > 0) {
      await del(pathsToDelete);
    }

    const index = await readObjectStorageIndex();
    for (const filePath of Object.keys(index.files)) {
      if (filePath === prefix || filePath.startsWith(`${prefix}/`)) {
        delete index.files[filePath];
      }
    }
    await writeObjectStorageIndex(index);
  }
}

class HybridObjectStorage {
  constructor() {
    this.fileSystem = new FileSystemObjectStorage();
    this.vercelBlob = new VercelBlobObjectStorage();
  }

  backend() {
    return shouldUseVercelBlob() ? this.vercelBlob : this.fileSystem;
  }

  async writeBuffer(relativePath, buffer, options = {}) {
    return this.backend().writeBuffer(relativePath, buffer, options);
  }

  async readBuffer(relativePath) {
    return this.backend().readBuffer(relativePath);
  }

  async getMetadata(relativePath) {
    return this.backend().getMetadata(relativePath);
  }

  async remove(relativePath) {
    return this.backend().remove(relativePath);
  }

  async removePrefix(prefix) {
    return this.backend().removePrefix(prefix);
  }

  isRemote() {
    return shouldUseVercelBlob();
  }
}

export function createObjectStorage() {
  return new HybridObjectStorage();
}

export const objectStorage = createObjectStorage();
