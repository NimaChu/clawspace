import path from 'node:path';
import JSZip from 'jszip';
import { canManageApps, getUsers } from './auth.js';
import { getAppStarSummaryMap, removeAppStars } from './app-stars.js';
import { getContentType } from './content-type.js';
import { objectStorage } from './object-storage.js';
import { runtimeStorage, isDatabaseQuotaExceededError } from './runtime-storage.js';

const REGISTRY_PATH = 'data/apps-registry.json';
const IMPORTED_METADATA_DIR = 'data/imported-apps';
const HOSTED_APPS_DIR = 'hosted-apps';
const APP_DOWNLOADS_DIR = 'downloads';
const MAX_HOSTED_APP_VERSIONS = 3;
const MAX_PACKAGE_FILE_COUNT = 500;
const MAX_EXPANDED_PACKAGE_BYTES = 50 * 1024 * 1024;
const MAX_PACKAGE_FILE_BYTES = 10 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_README_BYTES = 2 * 1024 * 1024;
const HOSTED_APPS_ORIGIN = String(process.env.HOSTED_APPS_ORIGIN || '').trim().replace(/\/$/, '');
const DEFAULT_COVER_VARIANT_COUNTS = {
  game: 3,
  ai: 3,
  ocr: 3,
  utility: 3,
  story: 3,
};

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeCreatorKey(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function buildDuplicateCreatorKeyMap(users) {
  const counts = new Map();
  users.forEach((user) => {
    const key = normalizeCreatorKey(user.displayName || user.email || '');
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

function resolveCreatorKeyForUser(user, duplicateCreatorKeys) {
  const base = normalizeCreatorKey(user?.displayName || user?.email || '');
  if (!user?.id) {
    return base;
  }

  if ((duplicateCreatorKeys.get(base) || 0) <= 1) {
    return base;
  }

  return `${base}-${user.id.split('-')[0]}`;
}

function createSlugConflictError({ slug, appName, ownerName }) {
  const error = new Error(
    ownerName
      ? `应用 slug「${slug}」已被用户「${ownerName}」占用，请修改后再上传。`
      : `应用 slug「${slug}」已存在，请修改后再上传。`
  );
  error.code = 'APP_SLUG_CONFLICT';
  error.status = 409;
  error.slug = slug;
  error.appName = appName || '';
  error.ownerName = ownerName || '';
  return error;
}

function canCurrentUserOverrideExistingApp(existingApp, currentUser) {
  if (!existingApp || !currentUser) {
    return false;
  }

  if (canManageApps(currentUser)) {
    return true;
  }

  if (existingApp.ownerUserId) {
    return existingApp.ownerUserId === currentUser.id;
  }

  // Legacy records without an owner id must be claimed by an administrator.
  return false;
}

function isSafeRelativePath(value) {
  if (!value || value.startsWith('/') || value.includes('\\')) {
    return false;
  }

  return !value.split('/').includes('..');
}

function assertZipEntrySize(entry, limit, label) {
  const declaredSize = Number(entry?._data?.uncompressedSize);
  if (Number.isFinite(declaredSize) && declaredSize > limit) {
    throw new Error(`${label} 解压后不能超过 ${Math.ceil(limit / 1024 / 1024)}MB`);
  }
}

function buildHostedBasePath(slug, hostedVersion = '') {
  if (hostedVersion) {
    return `/hosted-apps/${slug}/__versions/${hostedVersion}`;
  }

  return `/hosted-apps/${slug}`;
}

function toHostedUrl(slug, packagePath, hostedVersion = '') {
  const basePath = buildHostedBasePath(slug, hostedVersion);
  const hostedPath = packagePath.startsWith('app/')
    ? `${basePath}/${packagePath.slice(4)}`
    : `${basePath}/${packagePath}`;

  if (HOSTED_APPS_ORIGIN) {
    return `${HOSTED_APPS_ORIGIN}${hostedPath}`;
  }

  return hostedPath;
}

function buildHostedStoragePath(slug, hostedVersion = '') {
  if (hostedVersion) {
    return path.join(HOSTED_APPS_DIR, slug, '__versions', hostedVersion);
  }

  return path.join(HOSTED_APPS_DIR, slug);
}

function createHostedVersionToken(importedAt) {
  const source = String(importedAt || new Date().toISOString());
  return [...source].filter(char => !'-:.TZ'.includes(char)).join('').slice(0, 14);
}

function normalizeManifestVersion(value) {
  const version = String(value || '').trim();
  return version || '1.0.0';
}

function parseNumericVersion(value) {
  const match = String(value || '').trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/i);
  if (!match) {
    return null;
  }

  return [
    Number.parseInt(match[1] || '0', 10),
    Number.parseInt(match[2] || '0', 10),
    Number.parseInt(match[3] || '0', 10),
  ];
}

function compareNumericVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

function incrementVersionString(version) {
  const parsed = parseNumericVersion(version);
  if (parsed) {
    return `${parsed[0]}.${parsed[1]}.${parsed[2] + 1}`;
  }

  const revisionMatch = String(version || '').match(/^(.*?)-r(\d+)$/i);
  if (revisionMatch) {
    return `${revisionMatch[1]}-r${Number.parseInt(revisionMatch[2], 10) + 1}`;
  }

  return `${normalizeManifestVersion(version)}-r2`;
}

function resolveImportedVersion(existingApp, manifestVersion) {
  const nextVersion = normalizeManifestVersion(manifestVersion);
  if (!existingApp?.version) {
    return nextVersion;
  }

  if (nextVersion !== existingApp.version) {
    const incomingParsed = parseNumericVersion(nextVersion);
    const existingParsed = parseNumericVersion(existingApp.version);
    if (incomingParsed && existingParsed) {
      return compareNumericVersions(incomingParsed, existingParsed) > 0
        ? nextVersion
        : incrementVersionString(existingApp.version);
    }

    return nextVersion;
  }

  return incrementVersionString(existingApp.version);
}

function getRetainedHostedVersions(app) {
  const retained = new Set();

  if (app?.hostedVersion) {
    retained.add(String(app.hostedVersion));
  }

  const versionEntries = Array.isArray(app?.versionHistory) ? app.versionHistory.slice(0, MAX_HOSTED_APP_VERSIONS) : [];
  for (const entry of versionEntries) {
    const token = createHostedVersionToken(entry?.importedAt);
    if (token) {
      retained.add(token);
    }
  }

  return [...retained].filter(Boolean);
}

async function cleanupOldHostedVersions(slug, app) {
  const retainedVersions = new Set(getRetainedHostedVersions(app));
  const removableVersions = (Array.isArray(app?.versionHistory) ? app.versionHistory.slice(MAX_HOSTED_APP_VERSIONS) : [])
    .map((entry) => createHostedVersionToken(entry?.importedAt))
    .filter((token) => token && !retainedVersions.has(token));

  for (const hostedVersion of removableVersions) {
    await objectStorage.removePrefix(buildHostedStoragePath(slug, hostedVersion));
  }
}

async function ensureBaseDirectories() {
  await runtimeStorage.ensureDir('data');
  await runtimeStorage.ensureDir(IMPORTED_METADATA_DIR);
}

async function writeRuntimeFile(filePath, contents) {
  await objectStorage.writeBuffer(filePath, contents, {
    contentType: getContentType(filePath),
  });
}

function normalizeAppRecord(app) {
  const normalizedTags = Array.isArray(app?.tags)
    ? app.tags.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : [];
  const normalizedFeatures = Array.isArray(app?.features)
    ? app.features.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : [];
  const normalizedTechStack = Array.isArray(app?.techStack)
    ? app.techStack.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : [];
  const normalizedUsageSteps = Array.isArray(app?.usageSteps)
    ? app.usageSteps.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : [];
  const normalizedScreenshots = Array.isArray(app?.screenshotUrls)
    ? app.screenshotUrls.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : [];

  return {
    id: '',
    slug: '',
    name: '',
    description: '',
    category: '静态前端应用',
    runtime: 'static-front-end',
    tags: normalizedTags,
    features: normalizedFeatures,
    techStack: normalizedTechStack,
    usageSteps: normalizedUsageSteps,
    authorName: 'Unknown',
    authorUrl: '',
    creatorSlug: '',
    hasVerifiedCreator: false,
    githubUrl: '',
    homepageUrl: '',
    thumbnailUrl: '',
    thumbnailMobileUrl: '',
    iconUrl: '',
    screenshotUrls: normalizedScreenshots,
    hostedEntryUrl: '',
    launchUrl: '',
    downloadUrl: '',
    readme: '',
    published: true,
    stars: 0,
    modelCategory: 'none',
    ownerUserId: '',
    ownerDisplayName: '',
    hostedVersion: '',
    versionHistory: app.version
      ? [
          {
            version: app.version,
            importedAt: app.importedAt || new Date().toISOString(),
          },
        ]
      : [],
    ...app,
    name: String(app?.name || ''),
    description: String(app?.description || ''),
    category: String(app?.category || '静态前端应用'),
    runtime: String(app?.runtime || 'static-front-end'),
    authorName: String(app?.authorName || 'Unknown'),
    authorUrl: String(app?.authorUrl || ''),
    creatorSlug: String(app?.creatorSlug || ''),
    githubUrl: String(app?.githubUrl || ''),
    homepageUrl: String(app?.homepageUrl || ''),
    thumbnailUrl: String(app?.thumbnailUrl || ''),
    thumbnailMobileUrl: String(app?.thumbnailMobileUrl || ''),
    iconUrl: String(app?.iconUrl || ''),
    hostedEntryUrl: String(app?.hostedEntryUrl || ''),
    launchUrl: String(app?.launchUrl || ''),
    downloadUrl: String(app?.downloadUrl || ''),
    readme: String(app?.readme || ''),
    ownerUserId: String(app?.ownerUserId || ''),
    ownerDisplayName: String(app?.ownerDisplayName || ''),
    hostedVersion: String(app?.hostedVersion || ''),
    tags: normalizedTags,
    features: normalizedFeatures,
    techStack: normalizedTechStack,
    usageSteps: normalizedUsageSteps,
    screenshotUrls: normalizedScreenshots,
    versionHistory: Array.isArray(app.versionHistory) && app.versionHistory.length > 0
      ? app.versionHistory
      : app.version
        ? [
            {
              version: app.version,
              importedAt: app.importedAt || new Date().toISOString(),
            },
          ]
        : [],
  };
}

function resolveLinkedAuthorUrl(app, userMap) {
  const linkedUser = userMap.get(normalizeCreatorKey(app.authorName));
  if (!linkedUser) {
    return {
      authorUrl: app.authorUrl || '',
      githubUrl: app.githubUrl || '',
    };
  }

  if (!linkedUser.githubId) {
    return {
      authorUrl: '',
      githubUrl: '',
    };
  }

  const githubProfileUrl =
    linkedUser.githubProfileUrl ||
    (linkedUser.githubLogin ? `https://github.com/${linkedUser.githubLogin}` : '') ||
    app.authorUrl ||
    app.githubUrl ||
    '';

  return {
    authorUrl: githubProfileUrl,
    githubUrl: githubProfileUrl,
  };
}

async function decorateAppsWithLinkedAuthors(apps) {
  const users = await getUsers();
  const starSummaryMap = await getAppStarSummaryMap();
  const duplicateCreatorKeys = buildDuplicateCreatorKeyMap(users);
  const userMap = new Map(
    users.map((user) => [normalizeCreatorKey(user.displayName || user.email || ''), user])
  );
  const userById = new Map(users.map((user) => [user.id, user]));

  return apps.map((app) => {
    const ownerUser = app.ownerUserId ? userById.get(app.ownerUserId) || null : null;
    const effectiveAuthorName = ownerUser?.displayName || app.ownerDisplayName || app.authorName;
    const creatorSlug = ownerUser
      ? resolveCreatorKeyForUser(ownerUser, duplicateCreatorKeys)
      : '';
    const nextApp = {
      ...app,
      authorName: effectiveAuthorName,
      ownerDisplayName: ownerUser?.displayName || app.ownerDisplayName || '',
      creatorSlug,
      hasVerifiedCreator: Boolean(ownerUser && creatorSlug),
      stars: starSummaryMap.get(app.slug)?.count || 0,
    };

    return {
      ...nextApp,
      thumbnailDisplayUrl: toPublicWebThumbnailUrl(nextApp),
      miniProgramCoverUrl: toMiniProgramCoverUrl(nextApp),
      ...resolveLinkedAuthorUrl(nextApp, userMap),
    };
  });
}

export async function readRegistry() {
  await ensureBaseDirectories();

  try {
    const parsed = await runtimeStorage.readJson(REGISTRY_PATH, { apps: [] });
    return Array.isArray(parsed.apps)
      ? { apps: parsed.apps.map(normalizeAppRecord) }
      : { apps: [] };
  } catch (error) {
    if (isDatabaseQuotaExceededError(error)) {
      return { apps: [] };
    }
    if (error.code === 'ENOENT') {
      return { apps: [] };
    }

    throw error;
  }
}

export async function writeRegistry(registry) {
  await ensureBaseDirectories();
  await runtimeStorage.writeJson(REGISTRY_PATH, registry);
}

export async function getAllApps() {
  const registry = await readRegistry();
  const decoratedApps = await decorateAppsWithLinkedAuthors(registry.apps);

  return [...decoratedApps].sort((a, b) => {
    if (a.featured !== b.featured) {
      return a.featured ? -1 : 1;
    }

    if ((b.stars || 0) !== (a.stars || 0)) {
      return (b.stars || 0) - (a.stars || 0);
    }

    return String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN');
  });
}

export async function getPublishedApps() {
  const apps = await getAllApps();
  return apps.filter((app) => app.published !== false);
}

export async function getAppBySlug(slug) {
  const apps = await getAllApps();
  return apps.find((app) => app.slug === slug) ?? null;
}

function inferWeChatSupport(app) {
  const explicit = String(app?.wechatSupport || '').trim().toLowerCase();
  if (['full', 'partial', 'web_only'].includes(explicit)) {
    return explicit;
  }

  const haystack = [
    app?.name,
    app?.description,
    app?.category,
    ...(Array.isArray(app?.tags) ? app.tags : []),
    ...(Array.isArray(app?.features) ? app.features : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/(editor|ide|desktop|keyboard|multi-window|multiple windows|tabbed)/.test(haystack)) {
    return 'web_only';
  }

  if (/(ocr|upload|file|clipboard|multimodal|chat|generator|rewrite|ai|模型|识别|上传)/.test(haystack)) {
    return 'partial';
  }

  if (/(game|arcade|puzzle|rpg|pixel|story|adventure|action|casual|tetris|小游戏|游戏)/.test(haystack)) {
    return 'full';
  }

  return 'partial';
}

function normalizePublicTimestamp(app) {
  return (
    app?.updatedAt ||
    app?.importedAt ||
    app?.versionHistory?.[0]?.importedAt ||
    new Date(0).toISOString()
  );
}

function normalizeShareSubtitle(app) {
  return String(app?.shareSubtitle || '').trim() || String(app?.description || '').trim();
}

function isSvgAsset(url) {
  return typeof url === 'string' && /\.svg(?:[?#].*)?$/i.test(url.trim());
}

function stableStringHash(value) {
  const source = String(value || '');
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function inferMiniProgramCoverKind(app) {
  const explicit = String(app?.wechatSupport || '').trim().toLowerCase();
  const haystack = [
    app?.slug,
    app?.name,
    app?.description,
    app?.category,
    ...(Array.isArray(app?.tags) ? app.tags : []),
    ...(Array.isArray(app?.features) ? app.features : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/(ocr|vision|receipt|chart|scan|识别|图像|多模态)/.test(haystack)) {
    return 'ocr';
  }

  if (/(murder|mystery|detective|story|noir|manor|悬疑|探案|剧情)/.test(haystack)) {
    return 'story';
  }

  if (/(comeback|chat|rewrite|writer|dialog|llm|text|文案|对话|回复|写作)/.test(haystack)) {
    return 'ai';
  }

  if (
    explicit === 'full' ||
    /(game|arcade|puzzle|rpg|pixel|space|orbit|tetris|factory|quest|adventure|action|casual|小游戏|游戏)/.test(haystack)
  ) {
    return 'game';
  }

  return 'utility';
}

function getDefaultCoverUrl(app) {
  const kind = inferMiniProgramCoverKind(app);
  const variantCount = DEFAULT_COVER_VARIANT_COUNTS[kind] || 1;
  const variantSeed = app?.slug || app?.id || app?.name || kind;
  const variantIndex = (stableStringHash(variantSeed) % variantCount) + 1;
  return `/default-covers/${kind}-${variantIndex}.png`;
}

function toMiniProgramCoverUrl(app) {
  const url = String(app?.thumbnailMobileUrl || app?.thumbnailUrl || '').trim();
  if (url && !isSvgAsset(url)) {
    return url;
  }

  return getDefaultCoverUrl(app);
}

function toPublicWebThumbnailUrl(app) {
  const url = String(app?.thumbnailUrl || '').trim();
  if (url) {
    return url;
  }

  return getDefaultCoverUrl(app);
}

function toObjectStorageRelativePath(publicUrl) {
  const url = String(publicUrl || '').trim();
  if (!url.startsWith('/')) {
    return '';
  }

  if (url.startsWith('/hosted-apps/')) {
    return `hosted-apps/${url.slice('/hosted-apps/'.length)}`;
  }

  if (url.startsWith('/downloads/')) {
    return `downloads/${url.slice('/downloads/'.length)}`;
  }

  return '';
}

async function isResolvableHostedAsset(publicUrl) {
  const relativePath = toObjectStorageRelativePath(publicUrl);
  if (!relativePath) {
    return true;
  }

  try {
    await objectStorage.getMetadata(relativePath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }

    return false;
  }
}

async function resolvePublicCoverUrls(app) {
  const fallbackCoverUrl = getDefaultCoverUrl(app);
  const thumbnailUrl = toPublicWebThumbnailUrl(app);
  const miniProgramCoverUrl = toMiniProgramCoverUrl(app);

  const [thumbnailOk, miniProgramCoverOk] = await Promise.all([
    isResolvableHostedAsset(thumbnailUrl),
    isResolvableHostedAsset(miniProgramCoverUrl),
  ]);

  return {
    thumbnailUrl: thumbnailOk ? thumbnailUrl : fallbackCoverUrl,
    miniProgramCoverUrl: miniProgramCoverOk ? miniProgramCoverUrl : fallbackCoverUrl,
  };
}

function resolveManifestMobileThumbnail(manifest, zip, slug, hostedVersion = '') {
  if (manifest?.thumbnailMobile && typeof manifest.thumbnailMobile === 'string') {
    return toHostedUrl(slug, manifest.thumbnailMobile, hostedVersion);
  }

  if (zip.file('assets/thumbnail.png')) {
    return toHostedUrl(slug, 'assets/thumbnail.png', hostedVersion);
  }

  return '';
}

export function toPublicAppSummary(app) {
  return {
    slug: app.slug,
    name: app.name,
    description: app.description,
    thumbnailUrl: toPublicWebThumbnailUrl(app),
    miniProgramCoverUrl: toMiniProgramCoverUrl(app),
    iconUrl: app.iconUrl && !isSvgAsset(app.iconUrl) ? app.iconUrl : '',
    authorName: app.authorName || 'Unknown',
    authorSlug: app.creatorSlug || '',
    tags: Array.isArray(app.tags) ? app.tags : [],
    starCount: Number(app.stars || 0),
    isFeatured: Boolean(app.featured),
    wechatSupport: inferWeChatSupport(app),
    updatedAt: normalizePublicTimestamp(app),
  };
}

export async function toResolvedPublicAppSummary(app) {
  const summary = toPublicAppSummary(app);
  const covers = await resolvePublicCoverUrls(app);
  return {
    ...summary,
    thumbnailUrl: covers.thumbnailUrl,
    miniProgramCoverUrl: covers.miniProgramCoverUrl,
  };
}

export function toPublicAppDetail(app) {
  return {
    slug: app.slug,
    name: app.name,
    description: app.description,
    longDescription: app.readme || app.description || '',
    thumbnailUrl: toPublicWebThumbnailUrl(app),
    iconUrl: app.iconUrl && !isSvgAsset(app.iconUrl) ? app.iconUrl : '',
    screenshotUrls: Array.isArray(app.screenshotUrls)
      ? app.screenshotUrls.filter((item) => typeof item === 'string' && !isSvgAsset(item))
      : [],
    authorName: app.authorName || 'Unknown',
    authorSlug: app.creatorSlug || '',
    tags: Array.isArray(app.tags) ? app.tags : [],
    starCount: Number(app.stars || 0),
    launchUrl: app.launchUrl || '',
    hostedEntryUrl: app.hostedEntryUrl || '',
    downloadUrl: app.downloadUrl || '',
    wechatSupport: inferWeChatSupport(app),
    wechatNotes: String(app.wechatNotes || '').trim(),
    shareSubtitle: normalizeShareSubtitle(app),
    miniProgramCoverUrl: toMiniProgramCoverUrl(app),
    updatedAt: normalizePublicTimestamp(app),
  };
}

export async function toResolvedPublicAppDetail(app) {
  const detail = toPublicAppDetail(app);
  const covers = await resolvePublicCoverUrls(app);
  return {
    ...detail,
    thumbnailUrl: covers.thumbnailUrl,
    miniProgramCoverUrl: covers.miniProgramCoverUrl,
  };
}

function filterAppsByTag(apps, tag) {
  if (!tag) {
    return apps;
  }

  const normalizedTag = String(tag).trim().toLowerCase();
  return apps.filter((app) => (app.tags || []).some((item) => String(item).trim().toLowerCase() === normalizedTag));
}

function filterAppsByQuery(apps, query) {
  if (!query) {
    return apps;
  }

  const normalizedQuery = String(query).trim().toLowerCase();
  return apps.filter((app) => {
    const fields = [
      app.name,
      app.description,
      ...(Array.isArray(app.tags) ? app.tags : []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return fields.includes(normalizedQuery);
  });
}

function sortPublicApps(apps, sort = 'featured') {
  const nextApps = [...apps];
  const compareByUpdatedAt = (a, b) =>
    new Date(normalizePublicTimestamp(b)).getTime() - new Date(normalizePublicTimestamp(a)).getTime();

  if (sort === 'latest') {
    return nextApps.sort(compareByUpdatedAt);
  }

  if (sort === 'stars') {
    return nextApps.sort((a, b) => {
      if ((b.stars || 0) !== (a.stars || 0)) {
        return (b.stars || 0) - (a.stars || 0);
      }

      return compareByUpdatedAt(a, b);
    });
  }

  return nextApps.sort((a, b) => {
    if (Boolean(b.featured) !== Boolean(a.featured)) {
      return b.featured ? 1 : -1;
    }

    if ((b.stars || 0) !== (a.stars || 0)) {
      return (b.stars || 0) - (a.stars || 0);
    }

    return compareByUpdatedAt(a, b);
  });
}

export async function getPublicApps({ page = 1, pageSize = 12, tag = '', sort = 'featured', featured = false, query = '' } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 12));

  let apps = await getPublishedApps();
  apps = filterAppsByTag(apps, tag);
  apps = filterAppsByQuery(apps, query);

  if (featured) {
    apps = apps.filter((app) => Boolean(app.featured));
  }

  const sortedApps = sortPublicApps(apps, sort);
  const total = sortedApps.length;
  const start = (safePage - 1) * safePageSize;
  const items = await Promise.all(
    sortedApps.slice(start, start + safePageSize).map((app) => toResolvedPublicAppSummary(app))
  );

  return {
    items,
    page: safePage,
    pageSize: safePageSize,
    total,
    hasNextPage: start + safePageSize < total,
  };
}

export async function getPublicAppBySlug(slug) {
  const app = await getAppBySlug(slug);
  if (!app || app.published === false) {
    return null;
  }

  return toResolvedPublicAppDetail(app);
}

export async function searchPublicApps({ query = '', page = 1, pageSize = 12 } = {}) {
  const result = await getPublicApps({ page, pageSize, query, sort: 'featured' });
  return {
    query: String(query || ''),
    items: result.items,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    hasNextPage: result.hasNextPage,
  };
}

export async function getPublicTags(limit = 24) {
  const apps = await getPublishedApps();
  const counts = new Map();

  apps.forEach((app) => {
    (app.tags || []).forEach((tag) => {
      const normalizedTag = String(tag || '').trim();
      if (!normalizedTag) {
        return;
      }

      counts.set(normalizedTag, (counts.get(normalizedTag) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      return a.name.localeCompare(b.name, 'en');
    })
    .slice(0, Math.max(1, Number(limit) || 24));
}

export function canUserViewApp(app, user) {
  if (!app) {
    return false;
  }

  if (app.published !== false) {
    return true;
  }

  return canCurrentUserOverrideExistingApp(app, user);
}

export async function getRawRegistryAppBySlug(slug) {
  const registry = await readRegistry();
  return registry.apps.find((app) => app.slug === slug) ?? null;
}

export function canUserManageAppRecord(app, user) {
  return canCurrentUserOverrideExistingApp(app, user);
}

export async function deleteAppBySlug(slug) {
  const registry = await readRegistry();
  const nextApps = registry.apps.filter((app) => app.slug !== slug);

  if (nextApps.length === registry.apps.length) {
    return false;
  }

  registry.apps = nextApps;
  await writeRegistry(registry);

  await objectStorage.removePrefix(path.join(HOSTED_APPS_DIR, slug));
  await runtimeStorage.remove(path.join(IMPORTED_METADATA_DIR, slug), { recursive: true });
  await objectStorage.remove(path.join(APP_DOWNLOADS_DIR, `${slug}.zip`));
  await removeAppStars(slug);

  return true;
}

export async function deleteAppsByOwnerUserId(ownerUserId) {
  if (!ownerUserId) {
    return [];
  }

  const registry = await readRegistry();
  const ownedApps = registry.apps.filter((app) => app.ownerUserId === ownerUserId);
  const removedSlugs = [];

  for (const app of ownedApps) {
    const removed = await deleteAppBySlug(app.slug);
    if (removed) {
      removedSlugs.push(app.slug);
    }
  }

  return removedSlugs;
}

export async function syncAppsForOwnerProfile({ ownerUserId, ownerDisplayName }) {
  if (!ownerUserId || !String(ownerDisplayName || '').trim()) {
    return [];
  }

  const registry = await readRegistry();
  const updatedSlugs = [];

  registry.apps = registry.apps.map((app) => {
    if (app.ownerUserId !== ownerUserId) {
      return app;
    }

    updatedSlugs.push(app.slug);
    return normalizeAppRecord({
      ...app,
      ownerDisplayName: String(ownerDisplayName).trim(),
      authorName: String(ownerDisplayName).trim(),
      updatedAt: new Date().toISOString(),
    });
  });

  if (updatedSlugs.length > 0) {
    await writeRegistry(registry);
  }

  return updatedSlugs;
}

export async function updateAppPublication(slug, published) {
  const registry = await readRegistry();
  const index = registry.apps.findIndex((app) => app.slug === slug);

  if (index < 0) {
    return null;
  }

  registry.apps[index] = {
    ...registry.apps[index],
    published,
  };

  await writeRegistry(registry);
  return registry.apps[index];
}

export async function updateAppMetadata(slug, updates = {}) {
  const registry = await readRegistry();
  const index = registry.apps.findIndex((app) => app.slug === slug);

  if (index < 0) {
    return null;
  }

  const current = registry.apps[index];
  const next = {
    ...current,
  };

  const assignString = (field) => {
    if (field in updates) {
      next[field] = String(updates[field] || '').trim();
    }
  };

  for (const field of [
    'authorName',
    'authorUrl',
    'githubUrl',
    'homepageUrl',
    'thumbnailUrl',
    'thumbnailMobileUrl',
    'iconUrl',
    'ownerUserId',
    'ownerDisplayName',
    'shareSubtitle',
    'wechatSupport',
    'wechatNotes',
  ]) {
    assignString(field);
  }

  if ('featured' in updates) {
    next.featured = Boolean(updates.featured);
  }

  if ('published' in updates) {
    next.published = Boolean(updates.published);
  }

  next.updatedAt = new Date().toISOString();
  registry.apps[index] = normalizeAppRecord(next);

  await writeRegistry(registry);
  const decoratedApps = await decorateAppsWithLinkedAuthors([registry.apps[index]]);
  return decoratedApps[0] ?? registry.apps[index];
}

function buildVersionHistory(existingApp, manifest, importedAt) {
  const nextEntry = {
    version: manifest.version,
    importedAt,
  };

  if (!existingApp?.versionHistory?.length) {
    return [nextEntry];
  }

  const previous = existingApp.versionHistory.filter((entry) => entry.version !== manifest.version);
  return [nextEntry, ...previous];
}

function validateManifest(manifest) {
  const requiredFields = ['id', 'name', 'description', 'version', 'entry'];

  for (const field of requiredFields) {
    if (!manifest[field]) {
      throw new Error(`manifest.json 缺少必填字段: ${field}`);
    }
  }

  if (!isSafeRelativePath(manifest.entry) || !manifest.entry.startsWith('app/')) {
    throw new Error('manifest.json 的 entry 必须是 app/ 目录下的相对路径');
  }

  for (const assetField of ['thumbnail', 'icon']) {
    if (manifest[assetField] && !isSafeRelativePath(manifest[assetField])) {
      throw new Error(`manifest.json 的 ${assetField} 必须是安全的相对路径`);
    }
  }

  if (manifest.screenshots && !Array.isArray(manifest.screenshots)) {
    throw new Error('manifest.json 的 screenshots 必须是数组');
  }
}

function findConventionalAsset(zip, baseName) {
  const candidates = [
    `assets/${baseName}.png`,
    `assets/${baseName}.jpg`,
    `assets/${baseName}.jpeg`,
    `assets/${baseName}.webp`,
    `assets/${baseName}.svg`,
  ];

  return candidates.find((candidate) => zip.file(candidate)) || '';
}

function resolveManifestAssetPath(manifest, zip, fieldName, baseName) {
  const explicit = manifest?.[fieldName];
  if (typeof explicit === 'string' && explicit.trim()) {
    return explicit.trim();
  }

  return findConventionalAsset(zip, baseName);
}

export async function importAppPackage(buffer, options = {}) {
  await ensureBaseDirectories();

  const zip = await JSZip.loadAsync(buffer);
  const manifestEntry = zip.file('manifest.json');

  if (!manifestEntry) {
    throw new Error('上传包缺少 manifest.json');
  }

  assertZipEntrySize(manifestEntry, MAX_MANIFEST_BYTES, 'manifest.json');
  const manifestBuffer = Buffer.from(await manifestEntry.async('uint8array'));
  if (manifestBuffer.byteLength > MAX_MANIFEST_BYTES) {
    throw new Error('manifest.json 解压后不能超过 256KB');
  }
  const manifest = JSON.parse(manifestBuffer.toString('utf8'));
  if (options.modelCategory) {
    manifest.modelCategory = options.modelCategory;
  }
  validateManifest(manifest);

  const slug = normalizeSlug(manifest.slug || manifest.id);
  if (!slug) {
    throw new Error('manifest.json 的 slug 或 id 无法生成有效标识');
  }

  const registry = await readRegistry();
  const existingIndex = registry.apps.findIndex((app) => app.slug === slug);
  const existingApp = existingIndex >= 0 ? registry.apps[existingIndex] : null;
  manifest.version = resolveImportedVersion(existingApp, manifest.version);

  const users = await getUsers();
  const currentUser = options.importedBy
    ? users.find((user) => user.id === options.importedBy) || null
    : null;

  if (!currentUser) {
    const error = new Error('未登录用户不能导入应用');
    error.code = 'APP_AUTH_REQUIRED';
    error.status = 401;
    throw error;
  }

  if (existingApp && !canCurrentUserOverrideExistingApp(existingApp, currentUser)) {
    throw createSlugConflictError({
      slug,
      appName: existingApp.name,
      ownerName: existingApp.ownerDisplayName || existingApp.authorName,
    });
  }

  if (!zip.file(manifest.entry)) {
    throw new Error(`上传包缺少入口文件: ${manifest.entry}`);
  }

  const resolvedThumbnail = resolveManifestAssetPath(manifest, zip, 'thumbnail', 'thumbnail');
  const resolvedIcon = resolveManifestAssetPath(manifest, zip, 'icon', 'icon');

  const importedAt = new Date().toISOString();
  const hostedVersion = createHostedVersionToken(importedAt);
  const targetHostedDir = buildHostedStoragePath(slug, hostedVersion);
  const targetMetadataDir = path.join(IMPORTED_METADATA_DIR, slug);
  const targetDownloadPath = path.join(APP_DOWNLOADS_DIR, `${slug}.zip`);

  await runtimeStorage.remove(targetMetadataDir, { recursive: true });
  await objectStorage.remove(targetDownloadPath);
  await runtimeStorage.ensureDir(targetMetadataDir);

  const packageFiles = Object.values(zip.files).filter((entry) => !entry.dir);
  if (packageFiles.length > MAX_PACKAGE_FILE_COUNT) {
    throw new Error(`应用包文件数量不能超过 ${MAX_PACKAGE_FILE_COUNT}`);
  }

  let expandedBytes = manifestBuffer.byteLength;

  for (const file of packageFiles) {
    if (!isSafeRelativePath(file.name) || file.name === 'manifest.json' || file.name === 'README.md') {
      continue;
    }

    if (!file.name.startsWith('app/') && !file.name.startsWith('assets/')) {
      continue;
    }

    const relativePath = file.name.startsWith('app/') ? file.name.slice(4) : file.name;
    assertZipEntrySize(file, MAX_PACKAGE_FILE_BYTES, file.name);
    const fileBuffer = Buffer.from(await file.async('uint8array'));
    if (fileBuffer.byteLength > MAX_PACKAGE_FILE_BYTES) {
      throw new Error(`${file.name} 解压后不能超过 ${MAX_PACKAGE_FILE_BYTES / 1024 / 1024}MB`);
    }
    expandedBytes += fileBuffer.byteLength;
    if (expandedBytes > MAX_EXPANDED_PACKAGE_BYTES) {
      throw new Error(`应用包解压后不能超过 ${MAX_EXPANDED_PACKAGE_BYTES / 1024 / 1024}MB`);
    }
    await writeRuntimeFile(path.join(targetHostedDir, relativePath), fileBuffer);
  }

  const readmeEntry = zip.file('README.md');
  if (readmeEntry) {
    assertZipEntrySize(readmeEntry, MAX_README_BYTES, 'README.md');
  }
  const readmeBuffer = readmeEntry ? Buffer.from(await readmeEntry.async('uint8array')) : null;
  if (readmeBuffer && readmeBuffer.byteLength > MAX_README_BYTES) {
    throw new Error('README.md 解压后不能超过 2MB');
  }
  const longDescription = readmeBuffer ? readmeBuffer.toString('utf8') : manifest.longDescription || '';

  await runtimeStorage.writeJson(path.join(targetMetadataDir, 'manifest.json'), manifest);

  if (longDescription) {
    await runtimeStorage.writeText(path.join(targetMetadataDir, 'README.md'), longDescription, 'utf8');
  }

  await objectStorage.writeBuffer(targetDownloadPath, buffer, {
    contentType: 'application/zip',
  });

  const appRecord = {
    id: manifest.id,
    slug,
    name: manifest.name,
    description: manifest.description,
    version: manifest.version,
    category: manifest.category || '静态前端应用',
    runtime: manifest.runtime || 'static-front-end',
    featured: Boolean(manifest.featured),
    tags: Array.isArray(manifest.tags) ? manifest.tags : [],
    features: Array.isArray(manifest.features) ? manifest.features : [],
    techStack: Array.isArray(manifest.techStack) ? manifest.techStack : [],
    usageSteps: Array.isArray(manifest.usageSteps) ? manifest.usageSteps : [],
    modelCategory: ['none', 'text', 'multimodal', 'code'].includes(manifest.modelCategory)
      ? manifest.modelCategory
      : existingApp?.modelCategory || 'none',
    authorName: currentUser.displayName || manifest.author?.name || 'Unknown',
    authorUrl: '',
    stars: 0,
    githubUrl: '',
    homepageUrl: manifest.links?.homepage || '',
    thumbnailUrl: resolvedThumbnail ? toHostedUrl(slug, resolvedThumbnail, hostedVersion) : '',
    thumbnailMobileUrl: resolveManifestMobileThumbnail(manifest, zip, slug, hostedVersion),
    iconUrl: resolvedIcon ? toHostedUrl(slug, resolvedIcon, hostedVersion) : '',
    screenshotUrls: Array.isArray(manifest.screenshots)
      ? manifest.screenshots.map((item) => toHostedUrl(slug, item, hostedVersion))
      : [],
    hostedEntryUrl: toHostedUrl(slug, manifest.entry, hostedVersion),
    launchUrl: `/launch/${slug}`,
    downloadUrl: `/downloads/${slug}.zip`,
    published:
      typeof options.published === 'boolean'
        ? options.published
        : existingApp?.published ?? true,
    ownerUserId: existingApp?.ownerUserId || currentUser?.id || '',
    ownerDisplayName:
      existingApp?.ownerDisplayName ||
      currentUser?.displayName ||
      manifest.author?.name ||
      'Unknown',
    hostedVersion,
    importedAt,
    schemaVersion: manifest.schemaVersion || 1,
    readme: longDescription,
    versionHistory: buildVersionHistory(existingApp, manifest, importedAt),
  };

  if (existingIndex >= 0) {
    registry.apps[existingIndex] = appRecord;
  } else {
    registry.apps.push(appRecord);
  }

  await writeRegistry(registry);
  await cleanupOldHostedVersions(slug, appRecord);
  return {
    appRecord,
    overwritten: existingIndex >= 0,
    previousVersion: existingApp?.version || null,
  };
}
