import { getPublicAppBySlug } from '../../../../lib/app-registry.js';

export async function GET({ params }) {
  const app = await getPublicAppBySlug(params.slug);

  if (!app) {
    return Response.json(
      {
        error: 'App not found',
      },
      {
        status: 404,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  return Response.json(app, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=60',
    },
  });
}
