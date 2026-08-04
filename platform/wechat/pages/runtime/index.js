const { SITE_BASE_URL } = require('../../utils/config');

Page({
  data: {
    slug: '',
    src: '',
  },

  onLoad(query) {
    const slug = query.slug || '';
    const directSrc = typeof query.src === 'string' ? decodeURIComponent(query.src) : '';
    this.setData({
      slug,
      src: directSrc || (slug ? `${SITE_BASE_URL}/launch/${slug}?from=wechat-mini-program` : ''),
    });
  },
});
