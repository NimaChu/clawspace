import { runtimeStorage } from './runtime-storage.js';

const CREATOR_STYLE_PATH = 'data/creator-styles.json';

export const CREATOR_STYLE_PRESETS = {
  aurora: {
    id: 'aurora',
    name: '极光',
    accent: 'from-emerald-200 via-cyan-400 to-sky-700',
    orbitTone: 'rgba(16,185,129,0.28)',
  },
  sunset: {
    id: 'sunset',
    name: '日珥',
    accent: 'from-amber-100 via-orange-400 to-rose-600',
    orbitTone: 'rgba(249,115,22,0.28)',
  },
  nebula: {
    id: 'nebula',
    name: '星云',
    accent: 'from-violet-200 via-fuchsia-400 to-indigo-700',
    orbitTone: 'rgba(168,85,247,0.28)',
  },
};

async function ensureCreatorStyleFile() {
  await runtimeStorage.ensureDir('data');
  if (!(await runtimeStorage.exists(CREATOR_STYLE_PATH))) {
    await runtimeStorage.writeJson(CREATOR_STYLE_PATH, { items: [] });
  }
}

async function readCreatorStyles() {
  await ensureCreatorStyleFile();
  const parsed = await runtimeStorage.readJson(CREATOR_STYLE_PATH, { items: [] });
  return Array.isArray(parsed.items) ? parsed.items : [];
}

async function writeCreatorStyles(items) {
  await ensureCreatorStyleFile();
  await runtimeStorage.writeJson(CREATOR_STYLE_PATH, { items });
}

export async function getCreatorStyleOverrides() {
  const items = await readCreatorStyles();
  return new Map(items.map((item) => [item.slug, item]));
}

export async function updateCreatorStyle({ slug, preset }) {
  const presetData = CREATOR_STYLE_PRESETS[preset];
  if (!presetData) {
    throw new Error('不支持的星球样式');
  }

  const items = await readCreatorStyles();
  const index = items.findIndex((item) => item.slug === slug);
  const nextItem = {
    slug,
    preset,
    accent: presetData.accent,
    orbitTone: presetData.orbitTone,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    items[index] = nextItem;
  } else {
    items.push(nextItem);
  }

  await writeCreatorStyles(items);
  return nextItem;
}
