import { getCurrentUser } from '../../lib/auth.js';
import { getAppBySlug } from '../../lib/app-registry.js';
import { getGameScoreSummary, submitGameScore } from '../../lib/game-scores.js';

function noStoreJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function resolveAppId(request) {
  const url = new URL(request.url);
  return String(url.searchParams.get('appId') || url.searchParams.get('slug') || '').trim();
}

export async function GET({ request }) {
  try {
    const appId = resolveAppId(request);
    if (!appId) {
      return noStoreJson({ error: '缺少应用标识' }, 400);
    }

    const app = await getAppBySlug(appId);
    if (!app) {
      return noStoreJson({ error: '应用不存在' }, 404);
    }

    const currentUser = await getCurrentUser(request);
    const summary = await getGameScoreSummary({
      appId,
      userId: currentUser?.id || '',
    });

    return noStoreJson({
      ok: true,
      authenticated: Boolean(currentUser),
      appId,
      userBest: summary.userBest,
      globalBest: summary.globalBest,
    });
  } catch (error) {
    return noStoreJson({ error: error instanceof Error ? error.message : '读取分数失败' }, 400);
  }
}

export async function POST({ request }) {
  try {
    const currentUser = await getCurrentUser(request);
    const appId = resolveAppId(request);
    if (!appId) {
      return noStoreJson({ error: '缺少应用标识' }, 400);
    }

    const app = await getAppBySlug(appId);
    if (!app) {
      return noStoreJson({ error: '应用不存在' }, 404);
    }

    if (!currentUser) {
      return noStoreJson({ error: '请先登录后再同步分数' }, 401);
    }

    const payload = await request.json().catch(() => ({}));
    const score = payload?.score;
    const result = await submitGameScore({
      appId,
      user: currentUser,
      score,
    });

    return noStoreJson({
      ok: true,
      authenticated: true,
      appId,
      userBest: result.userBest,
      globalBest: result.globalBest,
    });
  } catch (error) {
    return noStoreJson({ error: error instanceof Error ? error.message : '保存分数失败' }, 400);
  }
}
