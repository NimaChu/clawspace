import { createHash } from 'node:crypto';
import { runtimeStorage } from './runtime-storage.js';

const AUTH_RATE_LIMIT_PATH = 'data/auth-rate-limit.json';
const AUTH_RATE_LIMIT_BYPASS_IPS = new Set(
  String(process.env.AUTH_RATE_LIMIT_BYPASS_IPS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);
const AUTH_RATE_LIMIT_BYPASS_EMAILS = new Set(
  String(process.env.AUTH_RATE_LIMIT_BYPASS_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

function hashEmail(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

function getBucketKey({ action, ip, email }) {
  return [String(action || 'unknown'), String(ip || 'unknown'), hashEmail(email)].join(':');
}

async function readBuckets() {
  const parsed = await runtimeStorage.readJson(AUTH_RATE_LIMIT_PATH, { items: [] });
  return Array.isArray(parsed.items) ? parsed.items : [];
}

async function writeBuckets(items) {
  await runtimeStorage.writeJson(AUTH_RATE_LIMIT_PATH, { items });
}

export function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return request.headers.get('x-real-ip') || 'unknown';
}

export function shouldBypassAuthRateLimit({ ip, email }) {
  const normalizedIp = String(ip || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (normalizedIp && AUTH_RATE_LIMIT_BYPASS_IPS.has(normalizedIp)) {
    return true;
  }

  if (normalizedEmail && AUTH_RATE_LIMIT_BYPASS_EMAILS.has(normalizedEmail)) {
    return true;
  }

  return false;
}

export async function consumeAuthRateLimit({ action, ip, email, perHourLimit = 10, perDayLimit = 30 }) {
  if (shouldBypassAuthRateLimit({ ip, email })) {
    return { allowed: true, bypassed: true };
  }

  const buckets = await readBuckets();
  const bucketKey = getBucketKey({ action, ip, email });
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const currentBucket = buckets.find((item) => item.key === bucketKey) || {
    key: bucketKey,
    action,
    ip: String(ip || 'unknown'),
    emailHash: hashEmail(email),
    hourHits: [],
    dayHits: [],
  };

  currentBucket.hourHits = (currentBucket.hourHits || []).filter((value) => value > oneHourAgo);
  currentBucket.dayHits = (currentBucket.dayHits || []).filter((value) => value > oneDayAgo);

  if (currentBucket.hourHits.length >= perHourLimit) {
    return { allowed: false, reason: '当前操作过于频繁，请一小时后再试。' };
  }

  if (currentBucket.dayHits.length >= perDayLimit) {
    return { allowed: false, reason: '今天的尝试次数已达上限，请明天再试。' };
  }

  currentBucket.hourHits.push(now);
  currentBucket.dayHits.push(now);

  const nextBuckets = buckets
    .filter((item) => item.key !== bucketKey)
    .concat(currentBucket)
    .slice(-1000);

  await writeBuckets(nextBuckets);

  return { allowed: true };
}
