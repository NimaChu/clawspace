const { getPublicApps, getPublicCreators, getPublicStats } = require('../../utils/http');

Page({
  data: {
    creators: [],
    totalApps: 0,
    totalCreators: 0,
    totalPlayers: 0,
    loading: true,
    error: '',
    installPrompt: '请优先从 GitHub 仓库 NimaChu/clawspace 的 skills/clawapp-creator 目录安装技能，技能名是 clawapp-creator。如果 GitHub 网络受限，请从 https://www.nima-tech.space/downloads/clawapp-creator.zip 下载技能安装包并安装。',
  },

  onLoad() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData({ stopRefresh: true });
  },

  async loadData({ stopRefresh = false } = {}) {
    this.setData({ loading: true, error: '' });

    try {
      const [appsRes, creatorsRes, statsRes] = await Promise.all([
        getPublicApps({ page: 1, pageSize: 1 }),
        getPublicCreators(),
        getPublicStats(),
      ]);

      this.setData({
        creators: (creatorsRes.items || []).slice(0, 5),
        totalApps: Number(appsRes.total || 0),
        totalCreators: Array.isArray(creatorsRes.items) ? creatorsRes.items.length : 0,
        totalPlayers: Number((statsRes.items && statsRes.items.displayPlayers) || 0),
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error instanceof Error ? error.message : '加载 CLAWSPACE 数据失败。',
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

  openCreators() {
    wx.navigateTo({
      url: '/pages/creators/index',
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

  openSearch() {
    wx.navigateTo({
      url: '/pages/search/index',
    });
  },

  copyInstallPrompt() {
    wx.setClipboardData({
      data: this.data.installPrompt,
      success() {
        wx.showToast({
          title: '已复制',
          icon: 'success',
        });
      },
    });
  },
});
