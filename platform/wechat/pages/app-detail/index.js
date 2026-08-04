const { getPublicAppDetail, getCurrentSessionUser, getCurrentUserStars, toggleAppStar } = require('../../utils/http');
const { SITE_BASE_URL } = require('../../utils/config');

function inferCoverKind(app) {
  const haystack = [
    app?.slug,
    app?.name,
    app?.description,
  ]
    .concat(Array.isArray(app?.tags) ? app.tags : [])
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/(ocr|vision|scan|receipt|chart|识别|图像|多模态)/.test(haystack)) {
    return 'ocr';
  }

  if (/(mystery|murder|detective|story|剧情|悬疑|探案)/.test(haystack)) {
    return 'story';
  }

  if (/(ai|llm|chat|write|planner|plan|daily|文案|对话|计划)/.test(haystack)) {
    return 'ai';
  }

  if (/(game|arcade|pixel|orbit|quest|factory|tetris|tank|adventure|action|游戏|小游戏)/.test(haystack)) {
    return 'game';
  }

  return 'utility';
}

function buildFallbackCoverUrl(app) {
  return `${SITE_BASE_URL}/default-covers/${inferCoverKind(app)}.png`;
}

function normalizeAppMedia(app) {
  if (!app || typeof app !== 'object') {
    return app;
  }

  const isSvg = (value) => typeof value === 'string' && /\.svg(?:\?|#|$)/i.test(value.trim());
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

  return Object.assign({}, app, {
    fallbackCoverUrl: buildFallbackCoverUrl(app),
    hostedEntryUrl: absolutize(app.hostedEntryUrl),
    launchUrl: absolutize(app.launchUrl),
    thumbnailUrl: absolutize(app.miniProgramCoverUrl || (isSvg(app.thumbnailUrl) ? '' : app.thumbnailUrl)),
    iconUrl: isSvg(app.iconUrl) ? '' : absolutize(app.iconUrl),
    screenshotUrls: Array.isArray(app.screenshotUrls)
      ? app.screenshotUrls.filter((item) => !isSvg(item)).map(absolutize)
      : [],
  });
}

Page({
  data: {
    slug: '',
    app: null,
    loading: true,
    error: '',
    isAuthenticated: false,
    isStarred: false,
    starBusy: false,
  },

  onLoad(query) {
    const slug = query.slug || '';
    this.setData({ slug });
    this.loadApp(slug);
  },

  async loadApp(slug) {
    if (!slug) {
      this.setData({
        loading: false,
        error: '缺少应用 slug。',
      });
      return;
    }

    this.setData({ loading: true, error: '' });

    try {
      const [appPayload, mePayload, starsPayload] = await Promise.all([
        getPublicAppDetail(slug),
        getCurrentSessionUser().catch(() => ({ authenticated: false })),
        getCurrentUserStars().catch(() => ({ items: [] })),
      ]);
      const app = normalizeAppMedia(appPayload);
      const starItems = Array.isArray(starsPayload.items) ? starsPayload.items : [];
      const isAuthenticated = Boolean(mePayload && mePayload.authenticated);
      const isStarred = starItems.some((item) => item.slug === slug);
      this.setData({
        app,
        loading: false,
        isAuthenticated,
        isStarred,
      });
      wx.setNavigationBarTitle({
        title: app.name || '应用详情',
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error instanceof Error ? error.message : '加载应用详情失败。',
      });
    }
  },

  openRuntime() {
    const { app } = this.data;
    const externalUrl = app?.hostedEntryUrl || app?.launchUrl || '';
    if (!externalUrl) {
      wx.showToast({
        title: '暂时没有可打开的链接',
        icon: 'none',
      });
      return;
    }

    wx.setClipboardData({
      data: externalUrl,
      success: () => {
        wx.showModal({
          title: '链接已复制',
          content: '已复制应用链接。请切到系统浏览器粘贴打开，或通过右上角菜单继续转到浏览器。',
          confirmText: '知道了',
          showCancel: false,
        });
      },
    });
  },

  async toggleStar() {
    const { slug, isAuthenticated, starBusy, app } = this.data;
    if (!slug || starBusy) {
      return;
    }

    if (!isAuthenticated) {
      wx.showToast({
        title: '请先去“我的”登录',
        icon: 'none',
      });
      return;
    }

    this.setData({ starBusy: true });

    try {
      const result = await toggleAppStar(slug);
      this.setData({
        starBusy: false,
        isStarred: Boolean(result.starred),
        app: Object.assign({}, app, {
          starCount: Number(result.count || 0),
        }),
      });
      wx.showToast({
        title: result.starred ? '已收藏' : '已取消收藏',
        icon: 'none',
      });
    } catch (error) {
      this.setData({ starBusy: false });
      wx.showToast({
        title: error instanceof Error ? error.message : '操作失败',
        icon: 'none',
      });
    }
  },

  handleCoverError() {
    const app = this.data.app;
    if (!app || !app.fallbackCoverUrl || app.thumbnailUrl === app.fallbackCoverUrl) {
      return;
    }

    this.setData({
      app: Object.assign({}, app, {
        thumbnailUrl: app.fallbackCoverUrl,
      }),
    });
  },

  onShareAppMessage() {
    const app = this.data.app;
    return {
      title: app?.name || 'CLAWSPACE',
      path: `/pages/app-detail/index?slug=${encodeURIComponent(this.data.slug)}`,
      desc: app?.shareSubtitle || app?.description || '在 CLAWSPACE 里打开这个应用。',
    };
  },
});
