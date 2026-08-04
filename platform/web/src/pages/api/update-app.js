import { canUserManageAppRecord, getAppBySlug, updateAppMetadata, updateAppPublication } from '../../lib/app-registry.js';
import { setAdminStarCount, toggleAppStar } from '../../lib/app-stars.js';
import { canManageApps, getCurrentUser, getUsers, isAdmin } from '../../lib/auth.js';

function normalizeDisplayName(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export async function POST({ request }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return new Response(JSON.stringify({ error: '未登录，无法执行此操作' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { slug, published, action } = body;

    if (action === 'toggle-star') {
      if (!slug) {
        return new Response(JSON.stringify({ error: '缺少应用标识' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const app = await getAppBySlug(slug);
      if (!app || app.published === false) {
        return new Response(JSON.stringify({ error: '应用不存在' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const result = await toggleAppStar({ slug, userId: currentUser.id });
      return new Response(JSON.stringify({ success: true, ...result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'set-star-count') {
      if (!isAdmin(currentUser)) {
        return new Response(JSON.stringify({ error: '只有管理员可以修改应用星标数量' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!slug) {
        return new Response(JSON.stringify({ error: '缺少应用标识' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const app = await getAppBySlug(slug);
      if (!app) {
        return new Response(JSON.stringify({ error: '应用不存在' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const result = await setAdminStarCount({ slug, count: body.count });
      return new Response(JSON.stringify({ success: true, ...result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update-metadata') {
      if (!isAdmin(currentUser)) {
        return new Response(JSON.stringify({ error: '只有管理员可以修改应用资料' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!slug) {
        return new Response(JSON.stringify({ error: '缺少应用标识' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
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

      if ('ownerUserId' in body) {
        const ownerUserId = String(body.ownerUserId || '').trim();
        if (ownerUserId) {
          const users = await getUsers();
          const match = users.find((user) => user.id === ownerUserId);
          if (match) {
            updates.ownerUserId = match.id;
            updates.ownerDisplayName = match.displayName;
            if (!('authorName' in updates)) {
              updates.authorName = match.displayName;
            }
          } else {
            throw new Error('目标作者账号不存在');
          }
        } else {
          updates.ownerUserId = '';
        }
      }

      const updatedApp = await updateAppMetadata(slug, updates);
      if (!updatedApp) {
        return new Response(JSON.stringify({ error: '应用不存在' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, app: updatedApp }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!slug || typeof published !== 'boolean') {
      return new Response(JSON.stringify({ error: '参数不完整' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const app = await getAppBySlug(slug);
    if (!app) {
      return new Response(JSON.stringify({ error: '应用不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const canManageThisApp = canManageApps(currentUser) || canUserManageAppRecord(app, currentUser);

    if (!canManageThisApp) {
      return new Response(JSON.stringify({ error: '当前账号没有管理这个应用的权限' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const updatedApp = await updateAppPublication(slug, published);

    return new Response(JSON.stringify({ success: true, app: updatedApp }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : '更新失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
