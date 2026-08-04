import { getCurrentUser, getUsers, isAdmin } from '../../../lib/auth.js';
import { updateAppMetadata } from '../../../lib/app-registry.js';

function normalizeDisplayName(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
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
    const slug = String(body.slug || '').trim();
    if (!slug) {
      throw new Error('缺少应用 slug');
    }

    const updates = {};
    for (const field of [
      'authorName',
      'authorUrl',
      'githubUrl',
      'homepageUrl',
      'thumbnailUrl',
      'thumbnailMobileUrl',
      'iconUrl',
      'shareSubtitle',
      'wechatSupport',
      'wechatNotes',
    ]) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if ('featured' in body) {
      updates.featured = Boolean(body.featured);
    }

    if ('published' in body) {
      updates.published = Boolean(body.published);
    }

    if ('ownerDisplayName' in body) {
      const ownerDisplayName = String(body.ownerDisplayName || '').trim();
      updates.ownerDisplayName = ownerDisplayName;
      if (ownerDisplayName) {
        const users = await getUsers();
        const match = users.find(
          (user) =>
            normalizeDisplayName(user.displayName || user.email || '') ===
            normalizeDisplayName(ownerDisplayName)
        );
        if (match) {
          updates.ownerUserId = match.id;
          updates.ownerDisplayName = match.displayName;
          if (!('authorName' in updates)) {
            updates.authorName = match.displayName;
          }
        } else {
          updates.ownerUserId = '';
        }
      } else {
        updates.ownerUserId = '';
      }
    }

    const app = await updateAppMetadata(slug, updates);
    if (!app) {
      return new Response(JSON.stringify({ error: 'App not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, app }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : '更新应用资料失败' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
