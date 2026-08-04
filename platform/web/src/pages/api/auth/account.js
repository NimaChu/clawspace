import { getCurrentUser, updateUserPassword, updateUserProfile } from '../../../lib/auth.js';
import { syncAppsForOwnerProfile } from '../../../lib/app-registry.js';

export async function POST({ request }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      throw new Error('请先登录');
    }

    const formData = await request.formData();
    const action = String(formData.get('action') || '');

    if (action === 'profile') {
      const email = String(formData.get('email') || '');
      const displayName = String(formData.get('displayName') || '');
      const previousDisplayName = currentUser.displayName;
      const user = await updateUserProfile({
        userId: currentUser.id,
        email,
        displayName,
      });

      let syncedApps = 0;
      if (user.displayName !== previousDisplayName) {
        syncedApps = (await syncAppsForOwnerProfile({
          ownerUserId: currentUser.id,
          ownerDisplayName: user.displayName,
        })).length;
      }

      return new Response(JSON.stringify({
        success: true,
        message: syncedApps > 0 ? `账号资料已更新，已同步 ${syncedApps} 个应用作者名` : '账号资料已更新',
        user,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'password') {
      const currentPassword = String(formData.get('currentPassword') || '');
      const nextPassword = String(formData.get('nextPassword') || '');
      const confirmPassword = String(formData.get('confirmPassword') || '');

      if (!nextPassword || !confirmPassword) {
        throw new Error('请填写完整的新密码信息');
      }

      if (nextPassword !== confirmPassword) {
        throw new Error('两次输入的新密码不一致');
      }

      const user = await updateUserPassword({
        userId: currentUser.id,
        currentPassword,
        nextPassword,
      });

      return new Response(JSON.stringify({ success: true, message: '密码已更新', user }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    throw new Error('不支持的账号操作');
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : '账号更新失败' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
