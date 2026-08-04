import {
  clearGitHubIntentCookie,
  clearGitHubStateCookie,
  createSession,
  createSessionCookie,
  getCurrentUser,
  linkGitHubToExistingUser,
  loginWithGitHubCode,
  readGitHubIntent,
  readCookieValue,
} from '../../../../lib/auth.js';

export async function GET({ request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = readCookieValue(request, 'nima_github_state');
  const intent = readGitHubIntent(request);
  const redirectOnError = intent.mode === 'link' ? '/account' : '/login';

  if (!code || !state || !cookieState || cookieState !== state) {
    const headers = new Headers();
    headers.set('Location', `${redirectOnError}?error=${encodeURIComponent('GitHub state 校验失败')}`);
    headers.append('Set-Cookie', clearGitHubStateCookie());
    headers.append('Set-Cookie', clearGitHubIntentCookie());

    return new Response(null, {
      status: 302,
      headers,
    });
  }

  try {
    const headers = new Headers();
    headers.append('Set-Cookie', clearGitHubStateCookie());
    headers.append('Set-Cookie', clearGitHubIntentCookie());

    if (intent.mode === 'link') {
      const currentUser = await getCurrentUser(request);
      if (!currentUser) {
        headers.set('Location', '/login?error=请先登录后再绑定 GitHub');
        return new Response(null, {
          status: 302,
          headers,
        });
      }

      await linkGitHubToExistingUser({ userId: currentUser.id, code, request });
      headers.set('Location', `${intent.next}?success=${encodeURIComponent('GitHub 账号已绑定')}`);
      return new Response(null, {
        status: 302,
        headers,
      });
    }

    const user = await loginWithGitHubCode({ code, request });
    const sessionToken = await createSession(user.id);
    headers.set('Location', intent.next || '/admin/import');
    headers.append('Set-Cookie', createSessionCookie(sessionToken));

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch (error) {
    const headers = new Headers();
    headers.set('Location', `${redirectOnError}?error=${encodeURIComponent(error instanceof Error ? error.message : 'GitHub 登录失败')}`);
    headers.append('Set-Cookie', clearGitHubStateCookie());
    headers.append('Set-Cookie', clearGitHubIntentCookie());

    return new Response(null, {
      status: 302,
      headers,
    });
  }
}
