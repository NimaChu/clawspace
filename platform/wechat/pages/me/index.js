const {
  getCurrentSessionUser,
  getCurrentUserStars,
  loginWithPassword,
  registerWithPassword,
  logout,
} = require('../../utils/http');
const { SITE_BASE_URL } = require('../../utils/config');

function normalizeCardMedia(app) {
  if (!app || typeof app !== 'object') {
    return app;
  }

  const absolutize = (value) => {
    if (typeof value !== 'string' || !value.trim()) {
      return '';
    }
    if (/^https?:\/\//i.test(value)) {
      return value;
    }
    if (value.startsWith('/')) {
      return `${SITE_BASE_URL}${value}`;
    }
    return value;
  };

  return {
    ...app,
    thumbnailUrl: absolutize(app.miniProgramCoverUrl || app.thumbnailUrl || ''),
  };
}

Page({
  data: {
    mode: 'login',
    loading: true,
    saving: false,
    error: '',
    success: '',
    user: null,
    starredApps: [],
    form: {
      displayName: '',
      email: '',
      password: '',
    },
  },

  onShow() {
    this.refreshMe();
  },

  async refreshMe() {
    this.setData({ loading: true, error: '', success: '' });

    try {
      const payload = await getCurrentSessionUser();
      const user = payload && payload.authenticated ? payload.user : null;

      if (!user) {
        this.setData({
          loading: false,
          user: null,
          starredApps: [],
        });
        return;
      }

      const starPayload = await getCurrentUserStars();
      const starredApps = Array.isArray(starPayload.items)
        ? starPayload.items.map(normalizeCardMedia)
        : [];

      this.setData({
        loading: false,
        user,
        starredApps,
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error instanceof Error ? error.message : '加载个人信息失败。',
      });
    }
  },

  switchMode(event) {
    const mode = event.currentTarget.dataset.mode || 'login';
    this.setData({
      mode,
      error: '',
      success: '',
    });
  },

  onInputChange(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    this.setData({
      [`form.${field}`]: event.detail.value,
    });
  },

  async submitAuth() {
    const { mode, form } = this.data;
    const payload = {
      email: String(form.email || '').trim(),
      password: String(form.password || ''),
    };

    if (mode === 'register') {
      payload.displayName = String(form.displayName || '').trim();
    }

    if (!payload.email || !payload.password || (mode === 'register' && !payload.displayName)) {
      this.setData({
        error: mode === 'register' ? '请填写显示名称、邮箱和密码。' : '请填写邮箱和密码。',
        success: '',
      });
      return;
    }

    this.setData({ saving: true, error: '', success: '' });

    try {
      if (mode === 'register') {
        await registerWithPassword(payload);
      } else {
        await loginWithPassword(payload);
      }

      this.setData({
        saving: false,
        success: mode === 'register' ? '注册成功，已自动登录。' : '登录成功。',
        form: {
          displayName: '',
          email: '',
          password: '',
        },
      });
      await this.refreshMe();
    } catch (error) {
      this.setData({
        saving: false,
        error: error instanceof Error ? error.message : '操作失败。',
      });
    }
  },

  async handleLogout() {
    this.setData({ saving: true, error: '', success: '' });

    try {
      await logout();
      this.setData({
        saving: false,
        success: '已退出登录。',
        user: null,
        starredApps: [],
      });
      await this.refreshMe();
    } catch (error) {
      this.setData({
        saving: false,
        error: error instanceof Error ? error.message : '退出失败。',
      });
    }
  },

  openAppDetail(event) {
    const slug = event.currentTarget.dataset.slug;
    if (!slug) return;
    wx.navigateTo({
      url: `/pages/app-detail/index?slug=${encodeURIComponent(slug)}`,
    });
  },
});
