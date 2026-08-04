import { runtimeStorage } from './runtime-storage.js';

const GAME_SCORES_PATH = 'data/game-scores.json';

async function ensureScoreFile() {
  await runtimeStorage.ensureDir('data');
  if (!(await runtimeStorage.exists(GAME_SCORES_PATH))) {
    await runtimeStorage.writeJson(GAME_SCORES_PATH, { apps: {} });
  }
}

async function readScoreState() {
  await ensureScoreFile();
  const parsed = await runtimeStorage.readJson(GAME_SCORES_PATH, { apps: {} });
  return {
    apps: parsed && typeof parsed.apps === 'object' && parsed.apps ? parsed.apps : {},
  };
}

async function writeScoreState(state) {
  await ensureScoreFile();
  await runtimeStorage.writeJson(GAME_SCORES_PATH, state);
}

function normalizeScore(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeAppScoreState(value) {
  const users = value && typeof value.users === 'object' && value.users ? value.users : {};
  const globalBest = value && typeof value.globalBest === 'object' && value.globalBest ? value.globalBest : null;
  return { users, globalBest };
}

function sanitizeEntry(entry) {
  if (!entry) return null;
  return {
    score: normalizeScore(entry.score, 0),
    updatedAt: entry.updatedAt || '',
    userId: entry.userId || '',
    userName: entry.userName || entry.displayName || '',
    displayName: entry.displayName || '',
  };
}

export async function getGameScoreSummary({ appId, userId = '' }) {
  if (!appId) {
    throw new Error('缺少应用标识');
  }

  const state = await readScoreState();
  const appScores = normalizeAppScoreState(state.apps[appId]);
  const userBest = userId ? sanitizeEntry(appScores.users[userId]) : null;
  const globalBest = sanitizeEntry(appScores.globalBest);

  return {
    appId,
    userBest,
    globalBest,
  };
}

export async function submitGameScore({ appId, user, score }) {
  if (!appId) {
    throw new Error('缺少应用标识');
  }
  if (!user?.id) {
    throw new Error('需要登录后才能同步分数');
  }

  const nextScore = normalizeScore(score, NaN);
  if (!Number.isFinite(nextScore) || nextScore < 0) {
    throw new Error('分数必须是大于等于 0 的数字');
  }

  const state = await readScoreState();
  const appScores = normalizeAppScoreState(state.apps[appId]);
  const now = new Date().toISOString();
  const currentUserBest = sanitizeEntry(appScores.users[user.id]);

  if (!currentUserBest || nextScore > currentUserBest.score) {
    appScores.users[user.id] = {
      score: nextScore,
      updatedAt: now,
      userId: user.id,
      userName: user.displayName || user.email || 'Player',
      displayName: user.displayName || user.email || 'Player',
    };
  }

  const refreshedUserBest = sanitizeEntry(appScores.users[user.id]);
  const currentGlobalBest = sanitizeEntry(appScores.globalBest);

  if (!currentGlobalBest || refreshedUserBest.score > currentGlobalBest.score) {
    appScores.globalBest = { ...refreshedUserBest };
  }

  state.apps[appId] = appScores;
  await writeScoreState(state);

  return {
    appId,
    userBest: refreshedUserBest,
    globalBest: sanitizeEntry(appScores.globalBest),
  };
}

export async function getRecordedPlayerCount() {
  const state = await readScoreState();
  const playerIds = new Set();

  Object.values(state.apps || {}).forEach((appState) => {
    const normalized = normalizeAppScoreState(appState);
    Object.keys(normalized.users || {}).forEach((userId) => {
      if (typeof userId === 'string' && userId.trim()) {
        playerIds.add(userId);
      }
    });
  });

  return playerIds.size;
}
