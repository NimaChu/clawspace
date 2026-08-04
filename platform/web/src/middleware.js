import { defineMiddleware } from 'astro:middleware';
import { getCurrentUser } from './lib/auth.js';
import { resetRuntimeStorageDegraded } from './lib/runtime-storage.js';

export const onRequest = defineMiddleware(async (context, next) => {
  resetRuntimeStorageDegraded();
  const requestUrl = new URL(context.request.url);
  const hostedAppsOrigin = String(process.env.HOSTED_APPS_ORIGIN || '').trim().replace(/\/$/, '');
  if (hostedAppsOrigin && requestUrl.origin === hostedAppsOrigin && !requestUrl.pathname.startsWith('/hosted-apps/')) {
    return new Response('Not found', { status: 404 });
  }

  const user = await getCurrentUser(context.request);
  context.locals.currentUser = user;

  const pathname = requestUrl.pathname;
  const isProtectedAdmin = pathname.startsWith('/admin');
  const isProtectedApi =
    pathname === '/api/import-app' ||
    pathname === '/api/upload-app-cover' ||
    pathname === '/api/delete-app' ||
    pathname === '/api/update-app';

  if (!user && (isProtectedAdmin || isProtectedApi)) {
    if (isProtectedApi) {
      return new Response(JSON.stringify({ error: '未登录，无法执行此操作' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return context.redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  return next();
});
