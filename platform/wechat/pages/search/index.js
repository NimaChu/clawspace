const { searchPublicApps } = require('../../utils/http');
const { SITE_BASE_URL } = require('../../utils/config');

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

  return {
    ...app,
    thumbnailUrl: absolutize(app.miniProgramCoverUrl || (isSvg(app.thumbnailUrl) ? '' : app.thumbnailUrl)),
    iconUrl: isSvg(app.iconUrl) ? '' : absolutize(app.iconUrl),
    screenshotUrls: Array.isArray(app.screenshotUrls)
      ? app.screenshotUrls.filter((item) => !isSvg(item)).map(absolutize)
      : [],
  };
}

Page({
  data: {
    query: '',
    items: [],
    loading: false,
    error: '',
    searched: false,
  },

  onLoad(query) {
    if (query.q) {
      this.setData({ query: query.q });
      this.runSearch();
    }
  },

  updateQuery(event) {
    this.setData({
      query: event.detail.value,
    });
  },

  async runSearch() {
    const query = (this.data.query || '').trim();
    if (!query) {
      this.setData({
        items: [],
        searched: false,
        error: '',
      });
      return;
    }

    this.setData({
      loading: true,
      error: '',
      searched: true,
    });

    try {
      const result = await searchPublicApps({
        q: query,
        pageSize: 12,
      });

      this.setData({
        items: (result.items || []).map(normalizeAppMedia),
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error instanceof Error ? error.message : '搜索应用失败。',
      });
    }
  },

  onConfirmSearch() {
    this.runSearch();
  },

  useSuggestedQuery(event) {
    const query = event.currentTarget.dataset.query || '';
    this.setData({ query });
    this.runSearch();
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
});
