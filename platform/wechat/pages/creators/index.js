const { getPublicCreators } = require('../../utils/http');

Page({
  data: {
    items: [],
    loading: true,
    error: '',
  },

  onLoad() {
    this.loadCreators();
  },

  onPullDownRefresh() {
    this.loadCreators({ stopRefresh: true });
  },

  async loadCreators({ stopRefresh = false } = {}) {
    this.setData({
      loading: true,
      error: '',
    });

    try {
      const result = await getPublicCreators();
      this.setData({
        items: result.items || [],
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error instanceof Error ? error.message : '加载作者排行失败。',
      });
    } finally {
      if (stopRefresh) {
        wx.stopPullDownRefresh();
      }
    }
  },

  openAtlas() {
    wx.switchTab({
      url: '/pages/atlas/index',
    });
  },

  openCreatorDetail(event) {
    const slug = event.currentTarget.dataset.slug;
    if (!slug) {
      return;
    }

    wx.navigateTo({
      url: `/pages/creator-detail/index?slug=${encodeURIComponent(slug)}`,
    });
  },
});
