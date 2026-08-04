import '../../../lib/env.js';
import { getCurrentUser, isAdmin } from '../../../lib/auth.js';
import { readSiteConfig, updateSiteConfig } from '../../../lib/site-config.js';

export async function GET({ request }) {
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

  const config = await readSiteConfig();
  return new Response(
    JSON.stringify({
      config,
      hasDashScopeKey: Boolean(process.env.DASHSCOPE_API_KEY),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
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
    const body = await request.json();
    const next = await updateSiteConfig({
      llm: {
        provider: 'dashscope',
        enabled: body.enabled !== false,
        models: {
          text: String(body.textModel || '').trim() || 'qwen3.5-plus',
          multimodal: String(body.multimodalModel || '').trim() || 'qwen3-vl-plus-2025-12-19',
          code: String(body.codeModel || '').trim() || 'qwen3-coder-next',
        },
        perIpPerMinute: Math.max(1, Number(body.perIpPerMinute) || 6),
        perIpPerDay: Math.max(1, Number(body.perIpPerDay) || 60),
      },
    });

    return new Response(JSON.stringify({ success: true, config: next }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : '保存站点模型配置失败',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
