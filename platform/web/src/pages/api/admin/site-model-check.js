import '../../../lib/env.js';
import { getCurrentUser, isAdmin } from '../../../lib/auth.js';
import { checkSiteModelsAvailability } from '../../../lib/llm.js';
import { readSiteConfig } from '../../../lib/site-config.js';

function normalizeCheckInput(body, fallbackConfig) {
  return {
    enabled: body?.enabled !== false,
    textModel: String(body?.textModel || '').trim() || fallbackConfig.llm.models.text,
    multimodalModel: String(body?.multimodalModel || '').trim() || fallbackConfig.llm.models.multimodal,
    codeModel: String(body?.codeModel || '').trim() || fallbackConfig.llm.models.code,
  };
}

export async function POST({ request }) {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!isAdmin(currentUser)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const currentConfig = await readSiteConfig();
    const body = await request.json().catch(() => ({}));
    const input = normalizeCheckInput(body, currentConfig);
    const result = await checkSiteModelsAvailability(input);

    return new Response(
      JSON.stringify({
        success: result.ok,
        result,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : '检测模型可用性失败',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
