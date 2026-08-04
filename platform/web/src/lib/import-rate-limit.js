import { runtimeStorage } from './runtime-storage.js';

const RATE_LIMIT_PATH = 'data/import-rate-limits.json';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const IMPORT_RATE_LIMIT_BYPASS_IPS = new Set(
  String(process.env.IMPORT_RATE_LIMIT_BYPASS_IPS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);
const IMPORT_RATE_LIMIT_BYPASS_EMAILS = new Set(
  String(process.env.IMPORT_RATE_LIMIT_BYPASS_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

async function ensureRateLimitFile() {
  await runtimeStorage.ensureDir('data');
  if (!(await runtimeStorage.exists(RATE_LIMIT_PATH))) {
    await runtimeStorage.writeJson(RATE_LIMIT_PATH, { entries: {} });
  }
}

async function readEntries() {
  await ensureRateLimitFile();
  const parsed = await runtimeStorage.readJson(RATE_LIMIT_PATH, { entries: {} });
  return parsed?.entries && typeof parsed.entries === 'object' ? parsed.entries : {};
}

async function writeEntries(entries) {
  await ensureRateLimitFile();
  await runtimeStorage.writeJson(RATE_LIMIT_PATH, { entries });
}

function buildKey({ userId, ip }) {
  return `${userId || 'anonymous'}::${ip || 'unknown'}`;
}

function pruneTimestamps(timestamps, now) {
  return (Array.isArray(timestamps) ? timestamps : []).filter((value) => now - value < DAY_MS);
}

export function shouldBypassImportRateLimit({ ip, email }) {
  const normalizedIp = String(ip || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (normalizedIp && IMPORT_RATE_LIMIT_BYPASS_IPS.has(normalizedIp)) {
    return true;
  }

  if (normalizedEmail && IMPORT_RATE_LIMIT_BYPASS_EMAILS.has(normalizedEmail)) {
    return true;
  }

  return false;
}

export async function consumeImportRateLimit({
  userId,
  ip,
  email = '',
  perHourLimit = 10,
  perDayLimit = 30,
}) {
  if (shouldBypassImportRateLimit({ ip, email })) {
    return {
      allowed: true,
      bypassed: true,
      usage: {
        hourCount: 0,
        dayCount: 0,
      },
    };
  }

  const now = Date.now();
  const entries = await readEntries();
  const key = buildKey({ userId, ip });
  const recent = pruneTimestamps(entries[key], now);
  const hourCount = recent.filter((value) => now - value < HOUR_MS).length;
  const dayCount = recent.length;

  if (hourCount >= perHourLimit) {
    return {
      allowed: false,
      reason: `上传过于频繁，请稍后再试（每小时最多 ${perHourLimit} 次）`,
    };
  }

  if (dayCount >= perDayLimit) {
    return {
      allowed: false,
      reason: `今日上传次数已达上限（每天最多 ${perDayLimit} 次）`,
    };
  }

  entries[key] = [...recent, now];
  await writeEntries(entries);

  return {
    allowed: true,
    usage: {
      hourCount: hourCount + 1,
      dayCount: dayCount + 1,
    },
  };
}
