import { del } from '@vercel/blob';
import { importAppPackage } from '../../lib/app-registry.js';
import { getCurrentUser } from '../../lib/auth.js';
import { consumeImportRateLimit } from '../../lib/import-rate-limit.js';
import { appendSecurityAudit } from '../../lib/security-audit.js';

const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
const PACKAGE_UPLOAD_PREFIX = 'package-uploads/';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normalizeModelCategory(value) {
  const category = String(value || 'none');
  return ['none', 'text', 'multimodal', 'code'].includes(category) ? category : 'none';
}

function normalizePublished(value, fallback = true) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (['true', '1', 'public', 'published', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'private', 'unlisted', 'hidden', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

function validateBlobLocation(blobUrl, blobPathname) {
  let parsed;
  try {
    parsed = new URL(blobUrl);
  } catch {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  const pathname = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
  return (
    parsed.protocol === 'https:' &&
    hostname.endsWith('.blob.vercel-storage.com') &&
    pathname === blobPathname
  );
}

async function importFromUploadedBlob(request, currentUser) {
  const payload = await request.json();
  const modelCategory = normalizeModelCategory(payload.modelCategory);
  const published = normalizePublished(payload.published, true);
  const blobUrl = String(payload.blobUrl || '').trim();
  const blobPathname = String(payload.blobPathname || '').trim().replace(/^\/+/, '');
  const ip = getClientIp(request);

  if (!blobUrl || !blobPathname) {
    return jsonResponse({ error: '缺少已上传应用包信息' }, 400);
  }

  if (!blobPathname.startsWith(PACKAGE_UPLOAD_PREFIX)) {
    return jsonResponse({ error: '非法应用包路径' }, 400);
  }

  if (!validateBlobLocation(blobUrl, blobPathname)) {
    return jsonResponse({ error: '非法对象存储地址' }, 400);
  }

  let importedResult = null;

  try {
    const response = await fetch(blobUrl);
    if (!response.ok) {
      return jsonResponse({ error: '无法读取已上传应用包' }, 400);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_UPLOAD_SIZE_BYTES) {
      return jsonResponse({ error: '应用包不能超过 25MB' }, 413);
    }

    importedResult = await importAppPackage(buffer, {
      modelCategory,
      published,
      importedBy: currentUser.id,
    });
    await appendSecurityAudit({
      type: 'import',
      status: 'success',
      ip,
      userId: currentUser.id,
      email: currentUser.email,
      slug: importedResult.appRecord.slug,
      detail: importedResult.overwritten
        ? `通过 Blob 覆盖上传应用（${published ? '公开' : '不公开'}）`
        : `通过 Blob 上传新应用（${published ? '公开' : '不公开'}）`,
    });
    return jsonResponse({ success: true, app: importedResult.appRecord, overwritten: importedResult.overwritten });
  } finally {
    try {
      await del(blobUrl);
    } catch {}
  }
}

export async function POST({ request }) {
  const ip = getClientIp(request);
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      await appendSecurityAudit({
        type: 'import',
        status: 'blocked',
        ip,
        detail: '未登录用户尝试上传应用',
      });
      return jsonResponse({ error: '未登录，无法执行此操作' }, 401);
    }

    const rateLimit = await consumeImportRateLimit({
      userId: currentUser.id,
      ip,
      email: currentUser.email,
      perHourLimit: 12,
      perDayLimit: 40,
    });
    if (rateLimit.bypassed) {
      await appendSecurityAudit({
        type: 'import',
        status: 'success',
        ip,
        userId: currentUser.id,
        email: currentUser.email,
        detail: '命中上传限流白名单，跳过频率限制',
      });
    }
    if (!rateLimit.allowed) {
      await appendSecurityAudit({
        type: 'import',
        status: 'blocked',
        ip,
        userId: currentUser.id,
        email: currentUser.email,
        detail: rateLimit.reason,
      });
      return jsonResponse({ error: rateLimit.reason }, 429);
    }

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return importFromUploadedBlob(request, currentUser);
    }

    const formData = await request.formData();
    const uploadedFile = formData.get('package');
    const modelCategory = normalizeModelCategory(formData.get('modelCategory'));
    const published = normalizePublished(formData.get('published'), true);

    if (!(uploadedFile instanceof File)) {
      return jsonResponse({ error: '请上传一个 zip 应用包' }, 400);
    }

    if (!uploadedFile.name.toLowerCase().endsWith('.zip')) {
      return jsonResponse({ error: '当前只支持 .zip 应用包' }, 400);
    }

    if (uploadedFile.size > MAX_UPLOAD_SIZE_BYTES) {
      return jsonResponse({ error: '应用包不能超过 25MB' }, 413);
    }

    const { appRecord, overwritten } = await importAppPackage(
      Buffer.from(await uploadedFile.arrayBuffer()),
      { modelCategory, published, importedBy: currentUser.id }
    );
    await appendSecurityAudit({
      type: 'import',
      status: 'success',
      ip,
      userId: currentUser.id,
      email: currentUser.email,
      slug: appRecord.slug,
      detail: overwritten
        ? `通过表单覆盖上传应用（${published ? '公开' : '不公开'}）`
        : `通过表单上传新应用（${published ? '公开' : '不公开'}）`,
    });

    return jsonResponse({ success: true, app: appRecord, overwritten });
  } catch (error) {
    await appendSecurityAudit({
      type: 'import',
      status: 'failed',
      ip,
      detail: error instanceof Error ? error.message : '导入失败',
      slug: error?.slug || '',
    });
    const status =
      typeof error?.status === 'number'
        ? error.status
        : error?.code === 'APP_SLUG_CONFLICT'
          ? 409
          : 500;

    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : '导入失败',
        code: error?.code || '',
        slug: error?.slug || '',
        appName: error?.appName || '',
        ownerName: error?.ownerName || '',
      },
      status
    );
  }
}
