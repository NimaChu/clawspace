const memoryStorage = new Map();

function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch (error) {
    // Fall back to in-memory storage when localStorage is unavailable.
  }
  return {
    getItem(key) {
      return memoryStorage.has(key) ? memoryStorage.get(key) : null;
    },
    setItem(key, value) {
      memoryStorage.set(key, String(value));
    },
    removeItem(key) {
      memoryStorage.delete(key);
    },
  };
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeScoreEntry(entry) {
  if (entry == null) {
    return null;
  }
  if (typeof entry === 'number') {
    return { score: normalizeNumber(entry, 0), userName: '', updatedAt: '' };
  }
  if (typeof entry === 'object') {
    const userName =
      typeof entry.userName === 'string'
        ? entry.userName
        : typeof entry.displayName === 'string'
          ? entry.displayName
          : '';
    return {
      score: normalizeNumber(entry.score, 0),
      userName,
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
    };
  }
  return null;
}

export function createGameStorage(namespace) {
  const storage = getStorage();
  const prefix = `clawspace:${namespace}:`;

  function getNumber(key, fallback = 0) {
    return normalizeNumber(storage.getItem(prefix + key), fallback);
  }

  function setNumber(key, value) {
    storage.setItem(prefix + key, String(normalizeNumber(value, 0)));
  }

  function updateBest(key, candidate, options = {}) {
    const fallback = normalizeNumber(options.fallback, 0);
    const mode = options.mode === 'min' ? 'min' : 'max';
    const current = getNumber(key, fallback);
    const next = normalizeNumber(candidate, fallback);
    const better = mode === 'min' ? next < current || current === fallback : next > current;

    if (better) {
      setNumber(key, next);
      return next;
    }
    return current;
  }

  function clear(key) {
    storage.removeItem(prefix + key);
  }

  async function fetchRemoteSummary(key, fallback = 0) {
    try {
      const response = await fetch(`/api/game-scores?appId=${encodeURIComponent(namespace)}`, {
        credentials: 'same-origin',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          authenticated: false,
          localBest: getNumber(key, fallback),
          userBest: null,
          globalBest: null,
          error: data?.error || 'score-summary-failed',
        };
      }
      return {
        authenticated: Boolean(data?.authenticated),
        localBest: getNumber(key, fallback),
        userBest: normalizeScoreEntry(data?.userBest),
        globalBest: normalizeScoreEntry(data?.globalBest),
        error: '',
      };
    } catch (error) {
      return {
        authenticated: false,
        localBest: getNumber(key, fallback),
        userBest: null,
        globalBest: null,
        error: error instanceof Error ? error.message : 'score-summary-failed',
      };
    }
  }

  async function syncBestScore(key, candidate, options = {}) {
    const fallback = normalizeNumber(options.fallback, 0);
    const localBest = updateBest(key, candidate, { mode: 'max', fallback });
    const summary = await fetchRemoteSummary(key, fallback);

    if (!summary.authenticated) {
      return {
        authenticated: false,
        localBest,
        userBest: null,
        globalBest: summary.globalBest,
      };
    }

    try {
      const response = await fetch(`/api/game-scores?appId=${encodeURIComponent(namespace)}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ score: localBest }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          authenticated: true,
          localBest,
          userBest: normalizeScoreEntry(summary.userBest),
          globalBest: normalizeScoreEntry(summary.globalBest),
          error: data?.error || 'score-submit-failed',
        };
      }
      return {
        authenticated: true,
        localBest,
        userBest: normalizeScoreEntry(data?.userBest),
        globalBest: normalizeScoreEntry(data?.globalBest),
        error: '',
      };
    } catch (error) {
        return {
          authenticated: true,
          localBest,
          userBest: normalizeScoreEntry(summary.userBest),
          globalBest: normalizeScoreEntry(summary.globalBest),
          error: error instanceof Error ? error.message : 'score-submit-failed',
        };
    }
  }

  return {
    getNumber,
    setNumber,
    updateBest,
    clear,
    fetchRemoteSummary,
    syncBestScore,
    normalizeScoreEntry,
  };
}
