const { API_BASE_URL, SITE_BASE_URL } = require('./config');
const SESSION_KEY = 'clawspace_session_cookie';

function getSessionCookie() {
  return wx.getStorageSync(SESSION_KEY) || '';
}

function setSessionCookie(cookie) {
  if (cookie) {
    wx.setStorageSync(SESSION_KEY, cookie);
    return;
  }

  wx.removeStorageSync(SESSION_KEY);
}

function extractSessionCookie(headers = {}) {
  const candidates = [
    headers['Set-Cookie'],
    headers['set-cookie'],
    headers['Set-cookie'],
  ].filter(Boolean);

  const raw = Array.isArray(candidates[0]) ? candidates[0][0] : candidates[0];
  if (!raw || typeof raw !== 'string') {
    return '';
  }

  const firstPair = raw.split(',').find((entry) => entry.includes('nima_session=')) || raw;
  const sessionPair = firstPair.split(';')[0].trim();
  if (sessionPair === 'nima_session=') {
    return '__CLEAR__';
  }
  return sessionPair;
}

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const sessionCookie = options.withAuth ? getSessionCookie() : '';
    wx.request({
      url: `${API_BASE_URL}${path}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
        ...(options.header || {}),
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(options.includeResponseMeta ? { data: res.data, headers: res.header || {}, statusCode: res.statusCode } : res.data);
          return;
        }

        reject(new Error(`Request failed (${res.statusCode})`));
      },
      fail(err) {
        reject(err);
      },
    });
  });
}

function siteRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const sessionCookie = options.withAuth ? getSessionCookie() : '';
    wx.request({
      url: `${SITE_BASE_URL}${path}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': options.contentType || 'application/json',
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
        ...(options.header || {}),
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(options.includeResponseMeta ? { data: res.data, headers: res.header || {}, statusCode: res.statusCode } : res.data);
          return;
        }

        const message =
          (res.data && (res.data.error || res.data.message)) ||
          `Request failed (${res.statusCode})`;
        reject(new Error(message));
      },
      fail(err) {
        reject(err);
      },
    });
  });
}

function withQuery(path, params = {}) {
  const queryParts = [];

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  });

  const queryString = queryParts.join('&');
  return queryString ? `${path}?${queryString}` : path;
}

function getPublicApps(params = {}) {
  return request(withQuery('/apps', params));
}

function getPublicAppDetail(slug) {
  return request(`/apps/${encodeURIComponent(slug)}`);
}

function searchPublicApps(params = {}) {
  return request(withQuery('/search', params));
}

function getPublicCreators() {
  return request('/creators');
}

function getPublicCreatorDetail(slug) {
  return request(`/creators/${encodeURIComponent(slug)}`);
}

function getPublicStats() {
  return request('/stats');
}

function getPublicTags(params = {}) {
  return request(withQuery('/tags', params));
}

function authRequest(path, data = {}) {
  return new Promise((resolve, reject) => {
    const sessionCookie = getSessionCookie();
    wx.request({
      url: path.startsWith('http') ? path : `${SITE_BASE_URL}/${path.replace(/^\/+/, '')}`,
      method: 'POST',
      data,
      header: {
        'content-type': 'application/x-www-form-urlencoded',
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      },
      success(res) {
        const nextCookie = extractSessionCookie(res.header || {});
        if (nextCookie === '__CLEAR__') {
          setSessionCookie('');
        } else if (nextCookie) {
          setSessionCookie(nextCookie);
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data || {});
          return;
        }

        const message =
          (res.data && (res.data.error || res.data.message)) ||
          `Request failed (${res.statusCode})`;
        reject(new Error(message));
      },
      fail(err) {
        reject(err);
      },
    });
  });
}

function loginWithPassword({ email, password }) {
  return authRequest('/api/auth/login', { email, password });
}

function registerWithPassword({ displayName, email, password }) {
  return authRequest('/api/auth/register', { displayName, email, password });
}

function logout() {
  return authRequest('/api/auth/logout', {});
}

function getCurrentSessionUser() {
  return request('/me', { withAuth: true });
}

function getCurrentUserStars() {
  return request('/me/stars', { withAuth: true });
}

function toggleAppStar(slug) {
  return siteRequest('/api/update-app', {
    method: 'POST',
    withAuth: true,
    data: {
      slug,
      action: 'toggle-star',
    },
  });
}

module.exports = {
  request,
  siteRequest,
  getSessionCookie,
  setSessionCookie,
  getPublicApps,
  getPublicAppDetail,
  searchPublicApps,
  getPublicCreators,
  getPublicCreatorDetail,
  getPublicStats,
  getPublicTags,
  loginWithPassword,
  registerWithPassword,
  logout,
  getCurrentSessionUser,
  getCurrentUserStars,
  toggleAppStar,
};
