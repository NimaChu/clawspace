import { createSession, createSessionCookie, registerPasswordUser } from '../../../lib/auth.js';
import { consumeAuthRateLimit, getClientIp } from '../../../lib/auth-rate-limit.js';
import { appendSecurityAudit } from '../../../lib/security-audit.js';

export async function POST({ request }) {
  const ip = getClientIp(request);
  try {
    const formData = await request.formData();
    const email = String(formData.get('email') || '');
    const password = String(formData.get('password') || '');
    const displayName = String(formData.get('displayName') || '');

    const rateLimit = await consumeAuthRateLimit({
      action: 'register',
      ip,
      email,
      perHourLimit: 6,
      perDayLimit: 20,
    });
    if (rateLimit.bypassed) {
      await appendSecurityAudit({
        type: 'register',
        status: 'success',
        ip,
        email,
        detail: '命中注册限流白名单，跳过频率限制',
      });
    }
    if (!rateLimit.allowed) {
      await appendSecurityAudit({
        type: 'register',
        status: 'blocked',
        ip,
        email,
        detail: rateLimit.reason,
      });
      const error = new Error(rateLimit.reason);
      error.auditLogged = true;
      throw error;
    }

    if (!email || !password) {
      throw new Error('邮箱和密码不能为空');
    }

    if (password.length < 8) {
      throw new Error('密码至少 8 位');
    }

    const user = await registerPasswordUser({ email, password, displayName });
    const sessionToken = await createSession(user.id);
    await appendSecurityAudit({
      type: 'register',
      status: 'success',
      ip,
      userId: user.id,
      email: user.email,
      detail: '用户完成邮箱注册',
    });

    return new Response(JSON.stringify({ success: true, user }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': createSessionCookie(sessionToken),
      },
    });
  } catch (error) {
    if (!error?.auditLogged) {
      await appendSecurityAudit({
        type: 'register',
        status: 'failed',
        ip,
        detail: error instanceof Error ? error.message : '注册失败',
      });
    }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : '注册失败' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
