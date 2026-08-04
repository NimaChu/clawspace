const { getPublicApps, getPublicTags } = require('../../utils/http');
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
    thumbnailUrl: absolutize(app.miniProgramCoverUrl || (isSvg(app.thumbnailUrl) ? '' : app.thumbnailUrl)),
    iconUrl: isSvg(app.iconUrl) ? '' : absolutize(app.iconUrl),
    screenshotUrls: Array.isArray(app.screenshotUrls)
      ? app.screenshotUrls.filter((item) => !isSvg(item)).map(absolutize)
      : [],
  });
}

Page({
  data: {
    items: [],
    tags: [],
    activeTag: '',
    page: 1,
    pageSize: 6,
    hasNextPage: false,
    loading: true,
    loadingMore: false,
    error: '',
  },

  onLoad(query) {
    this.setData({
      activeTag: query.tag || '',
    });
    this.loadInitial();
  },

  onShow() {
    const storedTag = wx.getStorageSync('atlasInitialTag');
    if (storedTag) {
      wx.removeStorageSync('atlasInitialTag');
      this.setData({
        activeTag: storedTag,
      });
      this.loadInitial();
      return;
    }

    if (this._pendingTag) {
      this.setData({
        activeTag: this._pendingTag,
      });
      this._pendingTag = '';
      this.loadInitial();
    }
  },

  onPullDownRefresh() {
    this.loadInitial({ stopRefresh: true });
  },

  async loadInitial({ stopRefresh = false } = {}) {
    this.setData({
      page: 1,
      items: [],
      loading: true,
      error: '',
    });

    try {
      const [appsRes, tagsRes] = await Promise.all([
        getPublicApps({
          page: 1,
          pageSize: this.data.pageSize,
          tag: this.data.activeTag,
          sort: 'featured',
        }),
        getPublicTags({ limit: 12 }),
      ]);

      this.setData({
        items: (appsRes.items || []).map(normalizeAppMedia),
        hasNextPage: Boolean(appsRes.hasNextPage),
        tags: tagsRes.items || [],
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error instanceof Error ? error.message : '加载应用星图失败。',
      });
    } finally {
      if (stopRefresh) {
        wx.stopPullDownRefresh();
      }
    }
  },

  async loadMore() {
    if (!this.data.hasNextPage || this.data.loadingMore) {
      return;
    }

    const nextPage = this.data.page + 1;
    this.setData({ loadingMore: true });

    try {
      const appsRes = await getPublicApps({
        page: nextPage,
        pageSize: this.data.pageSize,
        tag: this.data.activeTag,
        sort: 'featured',
      });

      this.setData({
        page: nextPage,
        items: this.data.items.concat((appsRes.items || []).map(normalizeAppMedia)),
        hasNextPage: Boolean(appsRes.hasNextPage),
        loadingMore: false,
      });
    } catch (error) {
      this.setData({
        loadingMore: false,
        error: error instanceof Error ? error.message : '加载更多应用失败。',
      });
    }
  },

  changeTag(event) {
    const tag = event.currentTarget.dataset.tag || '';
    this.setData({ activeTag: tag });
    this.loadInitial();
  },

  openAppDetail(event) {
    const { slug } = event.currentTarget.dataset;
    if (!slug) {
      return;
    }

    wx.navigateTo({
      url: `/pages/app-detail/index?slug=${encodeURIComponent(slug)}`,
    });
  },

  handleThumbError(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || index < 0) {
      return;
    }

    const items = this.data.items.slice();
    const item = items[index];
    if (!item || !item.fallbackCoverUrl || item.thumbnailUrl === item.fallbackCoverUrl) {
      return;
    }

    items[index] = Object.assign({}, item, {
      thumbnailUrl: item.fallbackCoverUrl,
    });

    this.setData({ items });
  },

  applyExternalTag(tag) {
    this._pendingTag = tag || '';
  },
});
