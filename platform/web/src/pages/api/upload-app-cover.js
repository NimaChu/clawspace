import path from 'node:path';
import { getCurrentUser, canManageApps } from '../../lib/auth.js';
import { canUserManageAppRecord, getAppBySlug, updateAppMetadata } from '../../lib/app-registry.js';
import { objectStorage } from '../../lib/object-storage.js';
import { appendSecurityAudit } from '../../lib/security-audit.js';

const MAX_COVER_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
]);

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

function canManageThisApp(app, currentUser) {
  if (!app || !currentUser) {
    return false;
  }

  return canManageApps(currentUser) || canUserManageAppRecord(app, currentUser);
}

function resolveExtension(file) {
  const explicitType = String(file?.type || '').trim().toLowerCase();
  if (ALLOWED_TYPES.has(explicitType)) {
    return ALLOWED_TYPES.get(explicitType);
  }

  const lowerName = String(file?.name || '').toLowerCase();
  if (lowerName.endsWith('.png')) return '.png';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return '.jpg';
  return '';
}

function isBitmapExtension(extension) {
  return extension === '.png' || extension === '.jpg';
}

function hasExpectedImageSignature(buffer, extension) {
  if (extension === '.png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }

  return extension === '.jpg' && buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

export async function POST({ request }) {
  const ip = getClientIp(request);
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return jsonResponse({ error: '未登录，无法上传封面' }, 401);
    }

    const formData = await request.formData();
    const slug = String(formData.get('slug') || '').trim();
    const file = formData.get('cover');

    if (!slug) {
      return jsonResponse({ error: '缺少应用标识' }, 400);
    }

    if (!(file instanceof File)) {
      return jsonResponse({ error: '请选择要上传的封面图片' }, 400);
    }

    const app = await getAppBySlug(slug);
    if (!app) {
      return jsonResponse({ error: '应用不存在' }, 404);
    }

    if (!canManageThisApp(app, currentUser)) {
      return jsonResponse({ error: '当前账号没有管理这个应用的权限' }, 403);
    }

    if (file.size <= 0) {
      return jsonResponse({ error: '封面图片不能为空' }, 400);
    }

    if (file.size > MAX_COVER_BYTES) {
      return jsonResponse({ error: '封面图片不能超过 8MB' }, 413);
    }

    const extension = resolveExtension(file);
    if (!extension) {
      return jsonResponse({ error: '当前只支持 PNG 或 JPG 封面图片' }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasExpectedImageSignature(buffer, extension)) {
      return jsonResponse({ error: '图片内容与 PNG/JPG 格式不匹配' }, 400);
    }
    const relativePath = path.posix.join('hosted-apps', slug, 'assets', `custom-cover${extension}`);
    await objectStorage.writeBuffer(relativePath, buffer, {
      contentType: file.type || undefined,
    });

    const publicUrl = `/hosted-apps/${slug}/assets/custom-cover${extension}`;
    const updatedApp = await updateAppMetadata(slug, {
      thumbnailUrl: publicUrl,
      thumbnailMobileUrl: isBitmapExtension(extension) ? publicUrl : '',
    });

    await appendSecurityAudit({
      type: 'import',
      status: 'success',
      ip,
      userId: currentUser.id,
      email: currentUser.email,
      slug,
      detail: `上传并更新应用封面（${extension}）`,
    });

    return jsonResponse({
      success: true,
      app: updatedApp,
      thumbnailUrl: updatedApp?.thumbnailDisplayUrl || updatedApp?.thumbnailUrl || publicUrl,
      thumbnailMobileUrl: updatedApp?.thumbnailMobileUrl || '',
    });
  } catch (error) {
    await appendSecurityAudit({
      type: 'import',
      status: 'failed',
      ip,
      detail: error instanceof Error ? error.message : '上传封面失败',
    });

    return jsonResponse(
      { error: error instanceof Error ? error.message : '上传封面失败' },
      500
    );
  }
}
