import {
  createPasswordUserByAdmin,
  deleteUserAccount,
  getCurrentUser,
  getUsers,
  isAdmin,
  updateUserRole,
} from '../../../lib/auth.js';
import { deleteAppsByOwnerUserId } from '../../../lib/app-registry.js';

export async function GET({ request }) {
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

  const users = await getUsers();
  return new Response(JSON.stringify({ users }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
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
    let user;

    if (body.action === 'create') {
      user = await createPasswordUserByAdmin({
        email: String(body.email || ''),
        password: String(body.password || ''),
        displayName: String(body.displayName || ''),
        role: String(body.role || 'member'),
      });
    } else if (body.action === 'delete') {
      user = await deleteUserAccount({
        userId: String(body.userId || ''),
        currentUserId: currentUser.id,
      });
      const removedApps = await deleteAppsByOwnerUserId(user.id);
      return new Response(JSON.stringify({ success: true, user, removedApps }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      user = await updateUserRole({
        userId: String(body.userId || ''),
        role: String(body.role || ''),
      });
    }

    return new Response(JSON.stringify({ success: true, user }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : '更新用户角色失败' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
