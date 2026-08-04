import { searchPublicApps } from '../../../lib/app-registry.js';

export async function GET({ request }) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const page = url.searchParams.get('page');
  const pageSize = url.searchParams.get('pageSize');

  const payload = await searchPublicApps({
    query: q,
    page,
    pageSize,
  });

  return Response.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=60',
    },
  });
}
