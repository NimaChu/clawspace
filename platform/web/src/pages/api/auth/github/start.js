import { createGitHubIntentCookie, createGitHubStateCookie, getGitHubAuthUrl } from '../../../../lib/auth.js';

export async function GET({ request }) {
  try {
    const requestUrl = new URL(request.url);
    const mode = requestUrl.searchParams.get('mode') === 'link' ? 'link' : 'login';
    const next = requestUrl.searchParams.get('next') || (mode === 'link' ? '/account' : '/admin/import');
    const { state, url, intent } = getGitHubAuthUrl(request, { mode, next });
    const headers = new Headers();
    headers.set('Location', url);
    headers.append('Set-Cookie', createGitHubStateCookie(state));
    headers.append('Set-Cookie', createGitHubIntentCookie(intent));

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitHub 登录暂不可用';
    const redirect = `/login?error=${encodeURIComponent(message)}`;
    return new Response(null, {
      status: 302,
      headers: {
        Location: redirect,
      },
    });
  }
}
