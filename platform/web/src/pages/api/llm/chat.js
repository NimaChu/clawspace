import { chatWithSiteModel } from '../../../lib/llm.js';
import { consumeLlmRateLimit } from '../../../lib/llm-rate-limit.js';
import { readSiteConfig } from '../../../lib/site-config.js';

function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return 'local';
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    const siteConfig = await readSiteConfig();
    const rateLimit = await consumeLlmRateLimit({
      ip: getClientIp(request),
      appId: body.appId || 'unknown-app',
      perMinuteLimit: siteConfig.llm.perIpPerMinute,
      perDayLimit: siteConfig.llm.perIpPerDay,
    });

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'RATE_LIMITED',
          message: rateLimit.reason,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const data = await chatWithSiteModel({
      appId: body.appId,
      messages: body.messages,
      temperature: body.temperature,
      max_tokens: body.max_tokens,
      model: body.model,
    });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '站点模型服务暂时不可用';
    const status = message.includes('DASHSCOPE_API_KEY') || message.includes('已关闭') ? 503 : 400;

    return new Response(
      JSON.stringify({
        error: 'SITE_LLM_ERROR',
        message,
      }),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

export function ALL() {
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
