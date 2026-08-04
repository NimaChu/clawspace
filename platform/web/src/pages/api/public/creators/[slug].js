import { getCreatorBySlug, getCreatorPath } from '../../../../lib/creator-universe.js';

export async function GET({ params }) {
  const creator = await getCreatorBySlug(params?.slug || '');

  if (!creator) {
    return Response.json(
      { error: 'CREATOR_NOT_FOUND', message: '未找到该作者。' },
      {
        status: 404,
        headers: {
          'Cache-Control': 'public, max-age=60',
        },
      }
    );
  }

  const works = Array.isArray(creator.works)
    ? creator.works.map((work) => ({
        slug: work.slug,
        name: work.name,
        description: work.description || '',
        starCount: Number(work.stars || 0),
        detailUrl: work.detailUrl || `/apps/${work.slug}`,
        launchUrl: work.launchUrl || '',
        thumbnailUrl: work.thumbnailDisplayUrl || work.thumbnailUrl || '',
        tags: Array.isArray(work.tags) ? work.tags : [],
        status: work.status || 'Live',
      }))
    : [];

  return Response.json(
    {
      slug: creator.slug,
      name: creator.name,
      headline: creator.headline || '',
      bio: creator.bio || '',
      starCount: Number(creator.totalStars || 0),
      appCount: works.length,
      profileUrl: creator.profileUrl || '',
      creatorPath: getCreatorPath(creator.slug),
      works,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=300',
      },
    }
  );
}
