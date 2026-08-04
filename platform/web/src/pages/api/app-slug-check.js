import { getCurrentUser } from '../../lib/auth.js';
import { canUserManageAppRecord, getRawRegistryAppBySlug } from '../../lib/app-registry.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function GET({ request }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return jsonResponse({ error: '未登录' }, 401);
    }

    const slug = normalizeSlug(new URL(request.url).searchParams.get('slug'));
    if (!slug) {
      return jsonResponse({ error: '缺少 slug' }, 400);
    }

    const app = await getRawRegistryAppBySlug(slug);
    if (!app) {
      return jsonResponse({
        success: true,
        slug,
        available: true,
        exists: false,
        canOverwrite: false,
      });
    }

    const canOverwrite = canUserManageAppRecord(app, currentUser);
    return jsonResponse({
      success: true,
      slug,
      available: canOverwrite,
      exists: true,
      canOverwrite,
      appName: app.name || '',
      ownerName: app.ownerDisplayName || app.authorName || '',
      version: app.version || '',
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : '检查 slug 失败',
      },
      500
    );
  }
}
