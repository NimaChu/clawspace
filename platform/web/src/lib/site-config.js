import './env.js';
import { runtimeStorage } from './runtime-storage.js';

const SITE_CONFIG_PATH = 'data/site-config.json';

const DEFAULT_SITE_CONFIG = {
  llm: {
    enabled: true,
    provider: 'dashscope',
    models: {
      text: process.env.DASHSCOPE_TEXT_MODEL || process.env.DASHSCOPE_MODEL || 'qwen3.5-plus',
      multimodal: process.env.DASHSCOPE_MULTIMODAL_MODEL || process.env.DASHSCOPE_MODEL || 'qwen3-vl-plus-2025-12-19',
      code: process.env.DASHSCOPE_CODE_MODEL || process.env.DASHSCOPE_MODEL || 'qwen3-coder-next',
    },
    perIpPerMinute: 6,
    perIpPerDay: 60,
  },
};

async function ensureSiteConfigFile() {
  await runtimeStorage.ensureDir('data');
  if (!(await runtimeStorage.exists(SITE_CONFIG_PATH))) {
    await runtimeStorage.writeJson(SITE_CONFIG_PATH, DEFAULT_SITE_CONFIG);
  }
}

function normalizeSiteConfig(config) {
  return {
    ...DEFAULT_SITE_CONFIG,
    ...config,
    llm: {
      ...DEFAULT_SITE_CONFIG.llm,
      ...(config?.llm || {}),
      models: {
        ...DEFAULT_SITE_CONFIG.llm.models,
        ...(config?.llm?.models || {}),
      },
    },
  };
}

export async function readSiteConfig() {
  await ensureSiteConfigFile();

  try {
    const parsed = await runtimeStorage.readJson(SITE_CONFIG_PATH, DEFAULT_SITE_CONFIG);
    return normalizeSiteConfig(parsed);
  } catch {
    return normalizeSiteConfig(DEFAULT_SITE_CONFIG);
  }
}

export async function updateSiteConfig(partialConfig) {
  const current = await readSiteConfig();
  const next = normalizeSiteConfig({
    ...current,
    ...partialConfig,
    llm: {
      ...current.llm,
      ...(partialConfig?.llm || {}),
    },
  });

  await runtimeStorage.writeJson(SITE_CONFIG_PATH, next);
  return next;
}
