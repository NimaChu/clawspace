import { getCurrentUser } from '../../../lib/auth.js';

export async function GET({ request }) {
  const user = await getCurrentUser(request);

  if (!user) {
    return Response.json(
      {
        authenticated: false,
        user: null,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  return Response.json(
    {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role || 'member',
        provider: user.provider || 'password',
        githubConnected: Boolean(user.githubConnected),
        avatarUrl: user.avatarUrl || '',
      },
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
