import path from 'node:path';
import { getCurrentUser } from '../../lib/auth.js';
import { canUserViewApp, getAppBySlug } from '../../lib/app-registry.js';
import { objectStorage } from '../../lib/object-storage.js';

function isSafeSlug(value) {
  return Boolean(value) && !String(value).includes('/') && !String(value).includes('\\') && !String(value).includes('..');
}

export async function GET({ params, request }) {
  const slug = params.slug;
  if (!isSafeSlug(slug)) {
    return new Response('Invalid file', { status: 400 });
  }

  const currentUser = await getCurrentUser(request);
  const app = await getAppBySlug(slug);
  if (!app || !canUserViewApp(app, currentUser)) {
    return new Response('Not found', { status: 404 });
  }

  const filePath = path.join('downloads', `${slug}.zip`);

  try {
    if (objectStorage.isRemote()) {
      const metadata = await objectStorage.getMetadata(filePath);
      if (metadata?.downloadUrl) {
        return Response.redirect(metadata.downloadUrl, 307);
      }
      if (metadata?.url) {
        return Response.redirect(metadata.url, 307);
      }
    }

    const contents = await objectStorage.readBuffer(filePath);

    return new Response(contents, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${slug}.zip"`,
      },
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return new Response('Not found', { status: 404 });
    }

    return new Response('Server error', { status: 500 });
  }
}
