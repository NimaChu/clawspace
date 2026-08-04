import { getPublicApps } from '../../../lib/app-registry.js';

export async function GET({ request }) {
  const url = new URL(request.url);
  const page = url.searchParams.get('page');
  const pageSize = url.searchParams.get('pageSize');
  const tag = url.searchParams.get('tag') || '';
  const sort = url.searchParams.get('sort') || 'featured';
  const featured = ['1', 'true', 'yes'].includes((url.searchParams.get('featured') || '').toLowerCase());
  const query = url.searchParams.get('q') || '';

  const payload = await getPublicApps({
    page,
    pageSize,
    tag,
    sort,
    featured,
    query,
  });

  return Response.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=60',
    },
  });
}
