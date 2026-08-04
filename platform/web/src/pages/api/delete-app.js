import { canUserManageAppRecord, deleteAppBySlug, getAppBySlug } from '../../lib/app-registry.js';
import { canManageApps, getCurrentUser } from '../../lib/auth.js';

export async function POST({ request }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return new Response(JSON.stringify({ error: '未登录，无法执行此操作' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { slug } = await request.json();

    if (!slug) {
      return new Response(JSON.stringify({ error: '缺少 slug' }), {
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
      return new Response(JSON.stringify({ error: '当前账号没有删除这个应用的权限' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await deleteAppBySlug(slug);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : '删除失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
