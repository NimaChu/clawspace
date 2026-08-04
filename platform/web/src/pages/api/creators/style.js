import { getCurrentUser } from '../../../lib/auth.js';
import { updateCreatorStyle } from '../../../lib/creator-styles.js';
import { slugifyCreatorName } from '../../../lib/creator-universe.js';

export async function POST({ request }) {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const slug = String(body.slug || '');
    const preset = String(body.preset || '');
    const currentUserSlug = slugifyCreatorName(currentUser.displayName || currentUser.email || '');

    if (slug !== currentUserSlug) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const style = await updateCreatorStyle({ slug, preset });
    return new Response(JSON.stringify({ success: true, style }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : '保存星球样式失败' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
