import { getCreators } from '../../../lib/creator-universe.js';

export async function GET() {
  const creators = await getCreators();
  const items = creators.map((creator) => ({
    slug: creator.slug,
    name: creator.name,
    starCount: Number(creator.totalStars || 0),
    appCount: Array.isArray(creator.works) ? creator.works.length : 0,
    avatarUrl: '',
  }));

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
