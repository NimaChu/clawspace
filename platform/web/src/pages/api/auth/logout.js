import { clearSessionCookie, deleteSession, readCookieValue } from '../../../lib/auth.js';

export async function POST({ request }) {
  const token = readCookieValue(request, 'nima_session');
  if (token) {
    await deleteSession(token);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookie(),
    },
  });
}
