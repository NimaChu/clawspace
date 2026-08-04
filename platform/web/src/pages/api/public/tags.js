import { getPublicTags } from '../../../lib/app-registry.js';

export async function GET({ request }) {
  const url = new URL(request.url);
  const limit = url.searchParams.get('limit');
  const items = await getPublicTags(limit);

  return Response.json(
    { items },
    {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=300',
      },
    }
  );
}
