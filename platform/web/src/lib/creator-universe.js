import { getAllApps, getPublishedApps } from './app-registry.js';
import { getUsers } from './auth.js';
import { getCreatorStyleOverrides } from './creator-styles.js';

const REAL_CREATOR_ACCENTS = [
  {
    accent: 'from-emerald-200 via-cyan-400 to-sky-700',
    orbitTone: 'rgba(16,185,129,0.28)',
  },
  {
    accent: 'from-violet-200 via-fuchsia-400 to-indigo-700',
    orbitTone: 'rgba(168,85,247,0.28)',
  },
  {
    accent: 'from-amber-100 via-orange-400 to-rose-600',
    orbitTone: 'rgba(249,115,22,0.28)',
  },
];

export function slugifyCreatorName(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'unknown-creator';
}

export function getCreatorPath(slug) {
  return `/creators/${encodeURIComponent(String(slug || '').trim())}`;
}

function buildDuplicateSlugCountMap(users) {
  const counts = new Map();
  users.forEach((user) => {
    const base = slugifyCreatorName(user.displayName || user.email || '');
    counts.set(base, (counts.get(base) || 0) + 1);
  });
  return counts;
}

function resolveCreatorSlugForUser(user, duplicateSlugCounts) {
  const base = slugifyCreatorName(user?.displayName || user?.email || '');
  if (!user?.id) {
    return base;
  }

  if ((duplicateSlugCounts.get(base) || 0) <= 1) {
    return base;
  }

  return `${base}-${user.id.split('-')[0]}`;
}

function toInitials(name) {
  return String(name || 'Unknown')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function buildRealCreators(apps, userById) {
  const grouped = new Map();
  const duplicateSlugCounts = buildDuplicateSlugCountMap([...userById.values()]);

  apps.forEach((app, index) => {
    const linkedUser = app.ownerUserId ? userById.get(app.ownerUserId) || null : null;
    if (!linkedUser) {
      return;
    }

    const authorName = app.ownerDisplayName || linkedUser.displayName || app.authorName || 'Unknown';
    const slug = resolveCreatorSlugForUser(linkedUser, duplicateSlugCounts);
    const groupKey = linkedUser.id || slug;
    const accentSeed = REAL_CREATOR_ACCENTS[index % REAL_CREATOR_ACCENTS.length];

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        slug,
        name: authorName,
        headline: app.category || 'Creative app maker',
        bio: `${authorName} 正在 Nima Tech Space 发布可直接体验的数字应用作品。`,
        profileUrl: '',
        accent: accentSeed.accent,
        orbitTone: accentSeed.orbitTone,
        totalStars: 0,
        works: [],
        source: 'imported',
        initials: toInitials(authorName),
      });
    }

    const creator = grouped.get(groupKey);
    if (app.ownerDisplayName && creator.name !== app.ownerDisplayName) {
      creator.name = app.ownerDisplayName;
      creator.slug = slugifyCreatorName(app.ownerDisplayName);
      creator.bio = `${app.ownerDisplayName} 正在 Nima Tech Space 发布可直接体验的数字应用作品。`;
      creator.initials = toInitials(app.ownerDisplayName);
    }
    creator.totalStars += app.stars || 0;
    creator.works.push({
      id: app.slug,
      slug: app.slug,
      name: app.name,
      description: app.description,
      tags: app.tags || [],
      stars: app.stars || 0,
      status: app.published === false ? 'Unlisted' : 'Live',
      detailUrl: `/apps/${app.slug}`,
      launchUrl: app.launchUrl,
      thumbnailDisplayUrl: app.thumbnailDisplayUrl || '',
      thumbnailUrl: app.thumbnailUrl,
      type: 'app',
    });
  });

  return [...grouped.values()].map((creator) => ({
    ...creator,
    works: creator.works.sort((a, b) => (b.stars || 0) - (a.stars || 0)),
  }));
}

function buildUserMap(users) {
  return new Map(
    users.map((user) => [
      slugifyCreatorName(user.displayName || user.email || ''),
      user,
    ])
  );
}

function buildEmptyCreatorProfile(user, duplicateSlugCounts) {
  const name = user?.displayName || user?.email || 'Unknown';
  const accentSeed = REAL_CREATOR_ACCENTS[0];
  const slug = resolveCreatorSlugForUser(user, duplicateSlugCounts);

  return {
    slug,
    name,
    headline: '这位作者正在准备自己的第一批作品。',
    bio: `${name} 已经加入 Nima Tech Space，正在整理自己的创作轨道，作品很快就会出现。`,
    profileUrl: user?.githubId
      ? user.githubProfileUrl || (user.githubLogin ? `https://github.com/${user.githubLogin}` : '')
      : '',
    accent: accentSeed.accent,
    orbitTone: accentSeed.orbitTone,
    totalStars: 0,
    works: [],
    source: 'profile',
    initials: toInitials(name),
    stylePreset: null,
  };
}

export async function getCreators(options = {}) {
  try {
    const apps = options.includeUnpublished ? await getAllApps() : await getPublishedApps();
    const users = await getUsers();
    const userMap = buildUserMap(users);
    const userById = new Map(users.map((user) => [user.id, user]));
    const overrides = await getCreatorStyleOverrides();
    const realCreators = buildRealCreators(apps, userById).map((creator) => {
      const linkedUser = userMap.get(creator.slug);
      const override = overrides.get(creator.slug);
      const baseCreator = {
        ...creator,
        profileUrl: linkedUser
          ? linkedUser.githubId
            ? linkedUser.githubProfileUrl || (linkedUser.githubLogin ? `https://github.com/${linkedUser.githubLogin}` : '')
            : ''
          : creator.profileUrl,
      };

      return override
        ? {
            ...baseCreator,
            accent: override.accent || baseCreator.accent,
            orbitTone: override.orbitTone || baseCreator.orbitTone,
            stylePreset: override.preset || null,
          }
        : baseCreator;
    });

    return [...realCreators].sort((a, b) => {
      if ((b.totalStars || 0) !== (a.totalStars || 0)) {
        return (b.totalStars || 0) - (a.totalStars || 0);
      }

      return a.name.localeCompare(b.name, 'en');
    });
  } catch (error) {
    if (error?.code === 'XX000' || /data transfer quota/i.test(String(error?.message || ''))) {
      return [];
    }
    throw error;
  }
}

export async function getCreatorSlugForUser(user) {
  if (!user) {
    return '';
  }

  const users = await getUsers();
  const duplicateSlugCounts = buildDuplicateSlugCountMap(users);
  return resolveCreatorSlugForUser(user, duplicateSlugCounts);
}

export async function getTopCreators(limit = 3) {
  const creators = await getCreators();
  return creators.slice(0, limit);
}

export async function getCreatorBySlug(slug, options = {}) {
  const creators = await getCreators(options);
  const raw = String(slug || '').trim();
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {}

  const existingCreator = creators.find((creator) => creator.slug === raw || creator.slug === decoded);
  if (existingCreator) {
    return existingCreator;
  }

  const users = await getUsers();
  const duplicateSlugCounts = buildDuplicateSlugCountMap(users);
  const matchedUser = users.find((user) => {
    const userSlug = resolveCreatorSlugForUser(user, duplicateSlugCounts);
    return userSlug === raw || userSlug === decoded;
  });

  if (!matchedUser) {
    return null;
  }

  return buildEmptyCreatorProfile(matchedUser, duplicateSlugCounts);
}
