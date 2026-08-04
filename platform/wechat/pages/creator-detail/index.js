const { getPublicCreatorDetail } = require('../../utils/http');
const { SITE_BASE_URL } = require('../../utils/config');

function inferCoverKind(item) {
  const haystack = [
    item?.slug,
    item?.name,
    item?.description,
  ]
    .concat(Array.isArray(item?.tags) ? item.tags : [])
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

function buildFallbackCoverUrl(item) {
  return `${SITE_BASE_URL}/default-covers/${inferCoverKind(item)}.png`;
}

function absolutize(value) {
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
}

function normalizeWork(work) {
  if (!work || typeof work !== 'object') {
    return work;
  }

  const thumbnailUrl = absolutize(work.thumbnailUrl);
  const fallbackCoverUrl = buildFallbackCoverUrl(work);

  return Object.assign({}, work, {
    thumbnailUrl: thumbnailUrl || fallbackCoverUrl,
    fallbackCoverUrl,
  });
}

Page({
  data: {
    slug: '',
    creator: null,
    loading: true,
    error: '',
  },

  onLoad(query) {
    const slug = query.slug || '';
    this.setData({ slug });
    this.loadCreator(slug);
  },

  onPullDownRefresh() {
    this.loadCreator(this.data.slug, { stopRefresh: true });
  },

  async loadCreator(slug, { stopRefresh = false } = {}) {
    if (!slug) {
      this.setData({
        loading: false,
        error: '缺少作者标识。',
      });
      return;
    }

    this.setData({
      loading: true,
      error: '',
    });

    try {
      const result = await getPublicCreatorDetail(slug);
      const creator = Object.assign({}, result, {
        works: Array.isArray(result.works) ? result.works.map(normalizeWork) : [],
      });
      this.setData({
        creator,
        loading: false,
      });
      wx.setNavigationBarTitle({
        title: creator.name || '作者主页',
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error instanceof Error ? error.message : '加载作者主页失败。',
      });
    } finally {
      if (stopRefresh) {
        wx.stopPullDownRefresh();
      }
    }
  },

  openAppDetail(event) {
    const slug = event.currentTarget.dataset.slug;
    if (!slug) {
      return;
    }

    wx.navigateTo({
      url: `/pages/app-detail/index?slug=${encodeURIComponent(slug)}`,
    });
  },

  handleCoverError(event) {
    const slug = event.currentTarget.dataset.slug;
    const creator = this.data.creator;
    if (!slug || !creator || !Array.isArray(creator.works)) {
      return;
    }

    const nextWorks = creator.works.map((work) => {
      if (work.slug !== slug || !work.fallbackCoverUrl || work.thumbnailUrl === work.fallbackCoverUrl) {
        return work;
      }

      return Object.assign({}, work, {
        thumbnailUrl: work.fallbackCoverUrl,
      });
    });

    this.setData({
      creator: Object.assign({}, creator, {
        works: nextWorks,
      }),
    });
  },
});
