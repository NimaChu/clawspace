import path from 'node:path';
import { getContentType, isHtmlContent } from '../../../lib/content-type.js';
import { objectStorage } from '../../../lib/object-storage.js';

function isSafePath(value) {
  return value && !value.split('/').includes('..') && !value.includes('\\');
}

export async function GET({ params }) {
  const slug = params.slug;
  const relativePath = params.path;

  if (!isSafePath(slug) || !isSafePath(relativePath)) {
    return new Response('Invalid path', { status: 400 });
  }

  const filePath = path.join('hosted-apps', slug, relativePath);
  const hostedAppsOrigin = String(process.env.HOSTED_APPS_ORIGIN || '').trim();
  const unsafeSameOriginAllowed = String(process.env.ALLOW_UNSAFE_SAME_ORIGIN_APPS || '').trim().toLowerCase() === 'true';

  if (isHtmlContent(filePath) && process.env.NODE_ENV === 'production' && !hostedAppsOrigin && !unsafeSameOriginAllowed) {
    return new Response('Hosted app isolation is not configured', { status: 503 });
  }

  try {
    if (!isHtmlContent(filePath) && objectStorage.isRemote()) {
      const metadata = await objectStorage.getMetadata(filePath);
      if (metadata?.url) {
        const isVersionedAsset = relativePath.includes('/__versions/') || relativePath.startsWith('__versions/');
        return new Response(null, {
          status: 307,
          headers: {
            Location: metadata.url,
            'Cache-Control': isVersionedAsset
              ? 'public, max-age=31536000, immutable'
              : 'public, max-age=300',
          },
        });
      }
    }

    const contents = await objectStorage.readBuffer(filePath);
    const isHtml = isHtmlContent(filePath);
    const isVersionedAsset = relativePath.includes('/__versions/') || relativePath.startsWith('__versions/');

    return new Response(contents, {
      status: 200,
      headers: {
        'Content-Type': getContentType(filePath),
        'Cache-Control': isHtml
          ? 'no-store'
          : isVersionedAsset
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=300',
      },
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return new Response('Not found', { status: 404 });
    }

    return new Response('Server error', { status: 500 });
  }
}
