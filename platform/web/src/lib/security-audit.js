import { runtimeStorage } from './runtime-storage.js';

const AUDIT_LOG_PATH = 'data/security-audit.json';
const MAX_AUDIT_ITEMS = 500;

async function readAuditLog() {
  const parsed = await runtimeStorage.readJson(AUDIT_LOG_PATH, { items: [] });
  return Array.isArray(parsed.items) ? parsed.items : [];
}

export async function appendSecurityAudit(entry) {
  const items = await readAuditLog();
  const nextItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: String(entry?.type || 'unknown'),
    status: String(entry?.status || 'info'),
    ip: String(entry?.ip || 'unknown'),
    userId: String(entry?.userId || ''),
    email: String(entry?.email || ''),
    slug: String(entry?.slug || ''),
    detail: String(entry?.detail || ''),
    createdAt: new Date().toISOString(),
  };

  items.unshift(nextItem);
  await runtimeStorage.writeJson(AUDIT_LOG_PATH, {
    items: items.slice(0, MAX_AUDIT_ITEMS),
  });

  return nextItem;
}
