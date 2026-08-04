import { getCurrentUser } from '../../../../lib/auth.js';
import { getUserStarredSlugs } from '../../../../lib/app-stars.js';
import { getAppBySlug, toResolvedPublicAppSummary } from '../../../../lib/app-registry.js';

export async function GET({ request }) {
  const user = await getCurrentUser(request);

  if (!user) {
    return Response.json(
      {
        authenticated: false,
        items: [],
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const slugs = await getUserStarredSlugs(user.id);
  const apps = await Promise.all(slugs.map((slug) => getAppBySlug(slug)));
  const items = (await Promise.all(
    apps
      .filter((app) => app && app.published !== false)
      .map((app) => toResolvedPublicAppSummary(app))
  )).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return Response.json(
    {
      authenticated: true,
      items,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
