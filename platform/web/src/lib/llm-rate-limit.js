import { runtimeStorage } from './runtime-storage.js';

const RATE_LIMIT_PATH = 'data/llm-rate-limits.json';
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function buildKey({ ip, appId }) {
  return `${ip}::${appId}`;
}

function pruneTimestamps(timestamps, now) {
  return (Array.isArray(timestamps) ? timestamps : []).filter((value) => now - value < DAY_MS);
}

export async function consumeLlmRateLimit({ ip, appId, perMinuteLimit, perDayLimit }) {
  const now = Date.now();
  const entries = await readEntries();
  const key = buildKey({ ip, appId });
  const recent = pruneTimestamps(entries[key], now);
  const minuteCount = recent.filter((value) => now - value < MINUTE_MS).length;
  const dayCount = recent.length;

  if (minuteCount >= perMinuteLimit) {
    return {
      allowed: false,
      reason: `请求过于频繁，请稍后再试（每分钟最多 ${perMinuteLimit} 次）`,
    };
  }

  if (dayCount >= perDayLimit) {
    return {
      allowed: false,
      reason: `今日模型调用次数已达上限（每天最多 ${perDayLimit} 次）`,
    };
  }

  entries[key] = [...recent, now];
  await writeEntries(entries);

  return {
    allowed: true,
    usage: {
      minuteCount: minuteCount + 1,
      dayCount: dayCount + 1,
    },
  };
}
