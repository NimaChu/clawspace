import { handleUpload } from '@vercel/blob/client';
import { getCurrentUser } from '../../lib/auth.js';

const ALLOWED_CONTENT_TYPES = ['application/zip', 'application/x-zip-compressed'];

function sanitizeZipPathname(value) {
  return String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/[^a-zA-Z0-9/_\-.]+/g, '-');
}

export async function POST({ request }) {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return Response.json({ error: '未登录，无法上传应用包' }, { status: 401 });
  }

  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const safePathname = sanitizeZipPathname(pathname);
        if (!safePathname.startsWith('package-uploads/')) {
          throw new Error('非法上传路径');
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            userId: currentUser.id,
            email: currentUser.email,
          }),
        };
      },
      onUploadCompleted: async () => {},
    });

    return Response.json(jsonResponse);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : '无法生成上传令牌',
      },
      { status: 400 }
    );
  }
}
