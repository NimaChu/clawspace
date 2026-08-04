import { runtimeStorage } from './runtime-storage.js';

const APP_STARS_PATH = 'data/app-stars.json';

async function ensureStarFile() {
  await runtimeStorage.ensureDir('data');
  if (!(await runtimeStorage.exists(APP_STARS_PATH))) {
    await runtimeStorage.writeJson(APP_STARS_PATH, { apps: {}, boosts: {} });
  }
}

async function readStarState() {
  await ensureStarFile();
  const parsed = await runtimeStorage.readJson(APP_STARS_PATH, { apps: {}, boosts: {} });
  return {
    apps: parsed && typeof parsed.apps === 'object' && parsed.apps ? parsed.apps : {},
    boosts: parsed && typeof parsed.boosts === 'object' && parsed.boosts ? parsed.boosts : {},
  };
}

async function writeStarState(state) {
  await ensureStarFile();
  await runtimeStorage.writeJson(APP_STARS_PATH, state);
}

function normalizeUserIds(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item) => typeof item === 'string' && item.trim()))]
    : [];
}

function normalizeBoost(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export async function getAppStarSummaryMap() {
  const state = await readStarState();
  const slugs = new Set([...Object.keys(state.apps), ...Object.keys(state.boosts || {})]);
  return new Map(
    [...slugs].map((slug) => [
      slug,
      {
        count: normalizeUserIds(state.apps[slug]).length + normalizeBoost(state.boosts?.[slug]),
        userIds: normalizeUserIds(state.apps[slug]),
        boost: normalizeBoost(state.boosts?.[slug]),
      },
    ])
  );
}

export async function getUserStarredSlugs(userId) {
  if (!userId) return [];
  const summaryMap = await getAppStarSummaryMap();
  return [...summaryMap.entries()]
    .filter(([, value]) => value.userIds.includes(userId))
    .map(([slug]) => slug);
}

export async function toggleAppStar({ slug, userId }) {
  if (!slug || !userId) {
    throw new Error('缺少 star 所需参数');
  }

  const state = await readStarState();
  const currentUserIds = normalizeUserIds(state.apps[slug]);
  const alreadyStarred = currentUserIds.includes(userId);
  const nextUserIds = alreadyStarred
    ? currentUserIds.filter((item) => item !== userId)
    : [...currentUserIds, userId];

  state.apps[slug] = nextUserIds;
  await writeStarState(state);

  return {
    slug,
    starred: !alreadyStarred,
    count: nextUserIds.length + normalizeBoost(state.boosts?.[slug]),
  };
}

export async function setAdminStarCount({ slug, count }) {
  if (!slug) {
    throw new Error('缺少应用标识');
  }

  const nextCount = Number.parseInt(String(count ?? ''), 10);
  if (!Number.isFinite(nextCount) || nextCount < 0) {
    throw new Error('星标数量必须是大于等于 0 的整数');
  }

  const state = await readStarState();
  const actualCount = normalizeUserIds(state.apps[slug]).length;
  const boost = Math.max(0, nextCount - actualCount);

  if (boost > 0) {
    state.boosts[slug] = boost;
  } else {
    delete state.boosts[slug];
  }

  await writeStarState(state);

  return {
    slug,
    count: actualCount + boost,
    actualCount,
    boost,
  };
}

export async function removeAppStars(slug) {
  if (!slug) return;

  const state = await readStarState();
  if (!(slug in state.apps) && !(slug in state.boosts)) {
    return;
  }

  delete state.apps[slug];
  delete state.boosts[slug];
  await writeStarState(state);
}
