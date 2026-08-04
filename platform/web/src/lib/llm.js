import './env.js';
import { getAllApps } from './app-registry.js';
import { readSiteConfig } from './site-config.js';

const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DEFAULT_MAX_TOKENS = 500;
const MODEL_CHECK_TIMEOUT_MS = 30000;

function normalizeContentPart(part) {
  if (!part || typeof part !== 'object' || typeof part.type !== 'string') {
    return null;
  }

  if (part.type === 'text' && typeof part.text === 'string' && part.text.trim()) {
    return {
      type: 'text',
      text: part.text,
    };
  }

  if (part.type === 'image_url') {
    const url = typeof part.image_url?.url === 'string' ? part.image_url.url.trim() : '';
    if (!url) {
      return null;
    }

    return {
      type: 'image_url',
      image_url: {
        url,
        ...(typeof part.image_url?.detail === 'string' && part.image_url.detail.trim()
          ? { detail: part.image_url.detail.trim() }
          : {}),
      },
    };
  }

  return null;
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages 不能为空');
  }

  const normalized = messages
    .map((message) => {
      if (!message || typeof message.role !== 'string') {
        return null;
      }

      if (typeof message.content === 'string' && message.content.trim()) {
        return {
          role: message.role,
          content: message.content,
        };
      }

      if (Array.isArray(message.content)) {
        const parts = message.content
          .map(normalizeContentPart)
          .filter(Boolean);

        if (parts.length === 0) {
          return null;
        }

        return {
          role: message.role,
          content: parts,
        };
      }

      return null;
    })
    .filter(Boolean);

  if (normalized.length === 0) {
    throw new Error('多模态消息格式无效，请检查 messages 是否包含文本或 image_url 内容');
  }

  return normalized;
}

function resolveModelByCategory(llmConfig, modelCategory) {
  const normalizedCategory = ['text', 'multimodal', 'code'].includes(modelCategory) ? modelCategory : 'text';
  return llmConfig.models?.[normalizedCategory] || llmConfig.models?.text || 'qwen3.5-plus';
}

function shouldDisableThinking(modelName) {
  return typeof modelName === 'string' && modelName.startsWith('qwen3.5-');
}

function sanitizeCompletionResponse(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitizedChoices = Array.isArray(data.choices)
    ? data.choices.map((choice) => {
        if (!choice || typeof choice !== 'object') {
          return choice;
        }

        const message =
          choice.message && typeof choice.message === 'object'
            ? {
                ...choice.message,
                reasoning_content: undefined,
              }
            : choice.message;

        return {
          ...choice,
          message,
        };
      })
    : data.choices;

  const usage =
    data.usage && typeof data.usage === 'object'
      ? {
          ...data.usage,
          completion_tokens_details: data.usage.completion_tokens_details
            ? {
                ...data.usage.completion_tokens_details,
                reasoning_tokens: undefined,
              }
            : data.usage.completion_tokens_details,
        }
      : data.usage;

  return {
    ...data,
    choices: sanitizedChoices,
    usage,
  };
}

async function parseDashScopeResponse(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return await response.json();
  }

  const text = await response.text();
  return {
    message: text,
  };
}

async function requestDashScopeCompletion({ apiKey, model, messages, max_tokens = 64, temperature = 0.1 }) {
  const payload = {
    model,
    messages,
    max_tokens,
    temperature,
  };

  if (shouldDisableThinking(model)) {
    payload.enable_thinking = false;
  }

  const response = await fetch(DASHSCOPE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(MODEL_CHECK_TIMEOUT_MS),
  });

  const data = await parseDashScopeResponse(response);

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `模型请求失败（${response.status}）`;
    throw new Error(message);
  }

  return data;
}

async function checkSingleModelAvailability({ apiKey, label, model, messages }) {
  const startedAt = Date.now();

  try {
    await requestDashScopeCompletion({
      apiKey,
      model,
      messages,
    });

    return {
      ok: true,
      label,
      model,
      latencyMs: Date.now() - startedAt,
      message: '模型可用',
    };
  } catch (error) {
    return {
      ok: false,
      label,
      model,
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : '模型检测失败',
    };
  }
}

export async function checkSiteModelsAvailability({
  enabled = true,
  textModel,
  multimodalModel,
  codeModel,
} = {}) {
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      provider: 'dashscope',
      checkedAt: new Date().toISOString(),
      error: '站点尚未配置 DASHSCOPE_API_KEY',
      models: {
        text: { ok: false, label: '文本模型', model: textModel || '', message: '缺少 API Key' },
        multimodal: { ok: false, label: '多模态模型', model: multimodalModel || '', message: '缺少 API Key' },
        code: { ok: false, label: 'Code 模型', model: codeModel || '', message: '缺少 API Key' },
      },
    };
  }

  if (enabled === false) {
    return {
      ok: false,
      provider: 'dashscope',
      checkedAt: new Date().toISOString(),
      error: '站点模型服务当前已关闭',
      models: {
        text: { ok: false, label: '文本模型', model: textModel || '', message: '站点模型服务已关闭' },
        multimodal: { ok: false, label: '多模态模型', model: multimodalModel || '', message: '站点模型服务已关闭' },
        code: { ok: false, label: 'Code 模型', model: codeModel || '', message: '站点模型服务已关闭' },
      },
    };
  }

  const checks = await Promise.all([
    checkSingleModelAvailability({
      apiKey,
      label: '文本模型',
      model: textModel,
      messages: [{ role: 'user', content: 'Reply with OK.' }],
    }),
    checkSingleModelAvailability({
      apiKey,
      label: '多模态模型',
      model: multimodalModel,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Reply with OK.' }],
        },
      ],
    }),
    checkSingleModelAvailability({
      apiKey,
      label: 'Code 模型',
      model: codeModel,
      messages: [{ role: 'user', content: 'Return a one-line JavaScript hello world example.' }],
    }),
  ]);

  const models = {
    text: checks[0],
    multimodal: checks[1],
    code: checks[2],
  };

  return {
    ok: checks.every((item) => item.ok),
    provider: 'dashscope',
    checkedAt: new Date().toISOString(),
    models,
  };
}

export async function resolveAppIdentity(appId) {
  const apps = await getAllApps();
  return apps.find((app) => app.id === appId || app.slug === appId) ?? null;
}

export async function chatWithSiteModel({ appId, messages, temperature, max_tokens, model }) {
  const siteConfig = await readSiteConfig();
  const llmConfig = siteConfig.llm;
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey) {
    throw new Error('站点尚未配置 DASHSCOPE_API_KEY');
  }

  if (llmConfig.enabled === false) {
    throw new Error('站点模型服务当前已关闭');
  }

  const app = await resolveAppIdentity(appId);
  if (!app) {
    throw new Error('未找到对应应用，无法调用站点模型');
  }

  if (app.modelCategory === 'none') {
    throw new Error('这个应用当前未启用站点模型');
  }

  const normalizedMessages = normalizeMessages(messages);
  const resolvedModel = model || resolveModelByCategory(llmConfig, app.modelCategory);
  const payload = {
    model: resolvedModel,
    messages: normalizedMessages,
    temperature: typeof temperature === 'number' ? temperature : 0.7,
    max_tokens: typeof max_tokens === 'number' ? max_tokens : DEFAULT_MAX_TOKENS,
  };

  const data = await requestDashScopeCompletion({
    apiKey,
    model: resolvedModel,
    messages: payload.messages,
    temperature: payload.temperature,
    max_tokens: payload.max_tokens,
  });

  return sanitizeCompletionResponse(data);
}
