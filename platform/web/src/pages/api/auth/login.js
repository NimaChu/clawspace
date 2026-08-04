import { createSession, createSessionCookie, verifyPasswordUser } from '../../../lib/auth.js';
import { consumeAuthRateLimit, getClientIp } from '../../../lib/auth-rate-limit.js';
import { appendSecurityAudit } from '../../../lib/security-audit.js';

export async function POST({ request }) {
  const ip = getClientIp(request);
  try {
    const formData = await request.formData();
    const email = String(formData.get('email') || '');
    const password = String(formData.get('password') || '');

    const rateLimit = await consumeAuthRateLimit({
      action: 'login',
      ip,
      email,
      perHourLimit: 10,
      perDayLimit: 40,
    });
    if (rateLimit.bypassed) {
      await appendSecurityAudit({
        type: 'login',
        status: 'success',
        ip,
        email,
        detail: '命中登录限流白名单，跳过频率限制',
      });
    }
    if (!rateLimit.allowed) {
      await appendSecurityAudit({
        type: 'login',
        status: 'blocked',
        ip,
        email,
        detail: rateLimit.reason,
      });
      const error = new Error(rateLimit.reason);
      error.auditLogged = true;
      throw error;
    }

    const user = await verifyPasswordUser({ email, password });
    const sessionToken = await createSession(user.id);
    await appendSecurityAudit({
      type: 'login',
      status: 'success',
      ip,
      userId: user.id,
      email: user.email,
      detail: '用户完成密码登录',
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
        type: 'login',
        status: 'failed',
        ip,
        detail: error instanceof Error ? error.message : '登录失败',
      });
    }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : '登录失败' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
