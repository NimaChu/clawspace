import { randomUUID, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import { runtimeStorage, isDatabaseQuotaExceededError } from './runtime-storage.js';

const USERS_PATH = 'data/users.json';
const SESSIONS_PATH = 'data/sessions.json';
const SESSION_COOKIE = 'nima_session';
const GITHUB_STATE_COOKIE = 'nima_github_state';
const GITHUB_INTENT_COOKIE = 'nima_github_intent';

async function ensureAuthFiles() {
  try {
    await runtimeStorage.ensureDir('data');

    for (const filePath of [USERS_PATH, SESSIONS_PATH]) {
      if (!(await runtimeStorage.exists(filePath))) {
        await runtimeStorage.writeJson(filePath, { items: [] });
      }
    }
  } catch (error) {
    if (isDatabaseQuotaExceededError(error)) {
      return;
    }
    throw error;
  }
}

async function readItems(filePath) {
  try {
    await ensureAuthFiles();
    const parsed = await runtimeStorage.readJson(filePath, { items: [] });
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch (error) {
    if (isDatabaseQuotaExceededError(error)) {
      return [];
    }
    throw error;
  }
}

async function writeItems(filePath, items) {
  await ensureAuthFiles();
  await runtimeStorage.writeJson(filePath, { items });
}

function normalizeStoredUsers(users) {
  return users.map((user, index) => ({
    ...user,
    role: user.role || (index === 0 ? 'admin' : 'member'),
  }));
}

function shouldGrantConfiguredAdmin(email) {
  const configuredEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  return Boolean(configuredEmail) && configuredEmail === String(email || '').trim().toLowerCase();
}

function shouldUseSecureCookies() {
  const explicit = String(process.env.COOKIE_SECURE || '').trim().toLowerCase();
  if (explicit) {
    return ['1', 'true', 'yes', 'on'].includes(explicit);
  }

  return process.env.NODE_ENV === 'production' || String(process.env.SITE_URL || '').startsWith('https://');
}

export async function getUsers() {
  const users = await readItems(USERS_PATH);
  return normalizeStoredUsers(users);
}

async function writeUsers(users) {
  return writeItems(USERS_PATH, users);
}

export async function updateUserRole({ userId, role }) {
  const allowedRoles = ['admin', 'editor', 'member'];
  if (!allowedRoles.includes(role)) {
    throw new Error('不支持的角色类型');
  }

  const users = await getUsers();
  const index = users.findIndex((user) => user.id === userId);
  if (index < 0) {
    throw new Error('用户不存在');
  }

  const adminCount = users.filter((user) => (user.role || 'member') === 'admin').length;
  if (users[index].role === 'admin' && role !== 'admin' && adminCount <= 1) {
    throw new Error('至少需要保留一个管理员账号');
  }

  users[index] = {
    ...users[index],
    role,
  };

  await writeUsers(users);
  return sanitizeUser(users[index]);
}

async function getSessions() {
  return readItems(SESSIONS_PATH);
}

async function writeSessions(sessions) {
  return writeItems(SESSIONS_PATH, sessions);
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return {
    role: 'member',
    ...safeUser,
    hasPassword: Boolean(passwordHash),
    githubConnected: Boolean(user.githubId),
  };
}

function validatePassword(password) {
  if (!password) {
    throw new Error('密码不能为空');
  }

  if (password.length < 8) {
    throw new Error('密码至少 8 位');
  }
}

function validateEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('邮箱不能为空');
  }

  if (!normalizedEmail.includes('@')) {
    throw new Error('邮箱格式不正确');
  }

  return normalizedEmail;
}

function normalizeDisplayName(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase();
}

function validateDisplayName(displayName, fallbackEmail = '') {
  const normalizedDisplayName = String(displayName || '').trim() || String(fallbackEmail || '').split('@')[0];
  if (!normalizedDisplayName) {
    throw new Error('显示名称不能为空');
  }

  return normalizedDisplayName;
}

export async function registerPasswordUser({ email, password, displayName }) {
  const users = await getUsers();
  const normalizedEmail = validateEmail(email);
  const normalizedDisplayName = validateDisplayName(displayName, normalizedEmail);
  validatePassword(password);

  if (users.some((user) => user.email === normalizedEmail)) {
    throw new Error('这个邮箱已经注册过了');
  }

  if (users.some((user) => normalizeDisplayName(user.displayName) === normalizeDisplayName(normalizedDisplayName))) {
    throw new Error('这个显示名称已经被其他账号使用');
  }

  const user = {
    id: randomUUID(),
    email: normalizedEmail,
    displayName: normalizedDisplayName,
    passwordHash: await bcrypt.hash(password, 10),
    provider: 'password',
    role: shouldGrantConfiguredAdmin(normalizedEmail) ? 'admin' : 'member',
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  await writeUsers(users);
  return sanitizeUser(user);
}

export async function createPasswordUserByAdmin({ email, password, displayName, role = 'member' }) {
  const users = await getUsers();
  const normalizedEmail = validateEmail(email);
  const normalizedDisplayName = validateDisplayName(displayName, normalizedEmail);
  validatePassword(password);

  if (!['admin', 'editor', 'member'].includes(role)) {
    throw new Error('不支持的角色类型');
  }

  if (users.some((user) => user.email === normalizedEmail)) {
    throw new Error('这个邮箱已经注册过了');
  }

  if (users.some((user) => normalizeDisplayName(user.displayName) === normalizeDisplayName(normalizedDisplayName))) {
    throw new Error('这个显示名称已经被其他账号使用');
  }

  const user = {
    id: randomUUID(),
    email: normalizedEmail,
    displayName: normalizedDisplayName,
    passwordHash: await bcrypt.hash(password, 10),
    provider: 'password',
    role,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  await writeUsers(users);
  return sanitizeUser(user);
}

export async function verifyPasswordUser({ email, password }) {
  const users = await getUsers();
  const user = users.find((item) => item.email === email.trim().toLowerCase());

  if (!user?.passwordHash) {
    throw new Error('账号或密码不正确');
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    throw new Error('账号或密码不正确');
  }

  return sanitizeUser(user);
}

export async function updateUserProfile({ userId, email, displayName }) {
  const users = await getUsers();
  const index = users.findIndex((user) => user.id === userId);
  if (index < 0) {
    throw new Error('当前账号不存在');
  }

  const normalizedEmail = validateEmail(email);
  const normalizedDisplayName = validateDisplayName(displayName, normalizedEmail);

  const duplicate = users.find((user) => user.email === normalizedEmail && user.id !== userId);
  if (duplicate) {
    throw new Error('这个邮箱已经被其他账号使用');
  }

  const duplicateDisplayName = users.find(
    (user) => normalizeDisplayName(user.displayName) === normalizeDisplayName(normalizedDisplayName) && user.id !== userId
  );
  if (duplicateDisplayName) {
    throw new Error('这个显示名称已经被其他账号使用');
  }

  users[index] = {
    ...users[index],
    email: normalizedEmail,
    displayName: normalizedDisplayName,
  };

  await writeUsers(users);
  return sanitizeUser(users[index]);
}

export async function updateUserPassword({ userId, currentPassword, nextPassword }) {
  const users = await getUsers();
  const index = users.findIndex((user) => user.id === userId);
  if (index < 0) {
    throw new Error('当前账号不存在');
  }

  validatePassword(nextPassword);

  const user = users[index];
  if (user.passwordHash) {
    if (!currentPassword) {
      throw new Error('请输入当前密码');
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new Error('当前密码不正确');
    }
  }

  users[index] = {
    ...user,
    passwordHash: await bcrypt.hash(nextPassword, 10),
    provider: resolveProvider({
      ...user,
      passwordHash: 'set',
    }, user.provider === 'github' ? 'github' : 'password'),
  };

  await writeUsers(users);
  return sanitizeUser(users[index]);
}

export async function createSession(userId) {
  const sessions = await getSessions();
  const token = randomUUID();

  sessions.push({
    id: token,
    userId,
    createdAt: new Date().toISOString(),
  });

  await writeSessions(sessions);
  await markUserLogin(userId);
  return token;
}

async function markUserLogin(userId) {
  const users = await getUsers();
  const index = users.findIndex((user) => user.id === userId);
  if (index < 0) return;

  users[index] = {
    ...users[index],
    lastLoginAt: new Date().toISOString(),
  };

  await writeUsers(users);
}

export async function deleteSession(token) {
  const sessions = await getSessions();
  await writeSessions(sessions.filter((session) => session.id !== token));
}

export async function getUserBySessionToken(token) {
  if (!token) return null;

  const sessions = await getSessions();
  const session = sessions.find((item) => item.id === token);
  if (!session) return null;

  const users = await getUsers();
  return sanitizeUser(users.find((user) => user.id === session.userId) || null);
}

export async function deleteUserAccount({ userId, currentUserId }) {
  const users = await getUsers();
  const target = users.find((user) => user.id === userId);

  if (!target) {
    throw new Error('用户不存在');
  }

  if (target.id === currentUserId) {
    throw new Error('不能删除当前登录中的管理员账号');
  }

  const adminCount = users.filter((user) => (user.role || 'member') === 'admin').length;
  if ((target.role || 'member') === 'admin' && adminCount <= 1) {
    throw new Error('至少需要保留一个管理员账号');
  }

  await writeUsers(users.filter((user) => user.id !== userId));

  const sessions = await getSessions();
  await writeSessions(sessions.filter((session) => session.userId !== userId));

  return sanitizeUser(target);
}

export function createSessionCookie(token) {
  return serializeCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: shouldUseSecureCookies(),
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie() {
  return serializeCookie(SESSION_COOKIE, '', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: shouldUseSecureCookies(),
    maxAge: 0,
  });
}

export async function getCurrentUser(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = parseCookie(cookieHeader);
  try {
    return await getUserBySessionToken(cookies[SESSION_COOKIE]);
  } catch (error) {
    if (isDatabaseQuotaExceededError(error)) {
      return null;
    }
    throw error;
  }
}

export function createGitHubStateCookie(state) {
  return serializeCookie(GITHUB_STATE_COOKIE, state, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: shouldUseSecureCookies(),
    maxAge: 60 * 10,
  });
}

export function clearGitHubStateCookie() {
  return serializeCookie(GITHUB_STATE_COOKIE, '', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: shouldUseSecureCookies(),
    maxAge: 0,
  });
}

export function readCookieValue(request, name) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = parseCookie(cookieHeader);
  return cookies[name] || null;
}

function getBaseUrl(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function normalizeNextPath(value, fallback = '/admin/import') {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  if (!normalized.startsWith('/') || normalized.startsWith('//')) {
    return fallback;
  }

  return normalized;
}

function resolveProvider(user, fallback = 'github') {
  const hasPassword = Boolean(user?.passwordHash);
  const hasGitHub = Boolean(user?.githubId) || fallback === 'github';

  if (hasPassword && hasGitHub) {
    return 'password+github';
  }

  if (hasPassword) {
    return 'password';
  }

  return 'github';
}

export function getGitHubAuthUrl(request, options = {}) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error('缺少 GITHUB_CLIENT_ID 环境变量');
  }

  const state = randomUUID();
  const redirectUri = `${getBaseUrl(request)}/api/auth/github/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state,
  });

  return {
    state,
    url: `https://github.com/login/oauth/authorize?${params.toString()}`,
    intent: {
      mode: options.mode === 'link' ? 'link' : 'login',
      next: normalizeNextPath(options.next, options.mode === 'link' ? '/account' : '/admin/import'),
    },
  };
}

export function createGitHubIntentCookie(intent = {}) {
  return serializeCookie(
    GITHUB_INTENT_COOKIE,
    JSON.stringify({
      mode: intent.mode === 'link' ? 'link' : 'login',
      next: normalizeNextPath(intent.next, intent.mode === 'link' ? '/account' : '/admin/import'),
    }),
    {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: shouldUseSecureCookies(),
      maxAge: 60 * 10,
    }
  );
}

export function clearGitHubIntentCookie() {
  return serializeCookie(GITHUB_INTENT_COOKIE, '', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: shouldUseSecureCookies(),
    maxAge: 0,
  });
}

export function readGitHubIntent(request) {
  const raw = readCookieValue(request, GITHUB_INTENT_COOKIE);
  if (!raw) {
    return { mode: 'login', next: '/admin/import' };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      mode: parsed?.mode === 'link' ? 'link' : 'login',
      next: normalizeNextPath(parsed?.next, parsed?.mode === 'link' ? '/account' : '/admin/import'),
    };
  } catch {
    return { mode: 'login', next: '/admin/import' };
  }
}

async function upsertGitHubUser(profile) {
  const users = await getUsers();
  const githubId = String(profile.id);
  const primaryEmail = profile.email || `${profile.login}@users.noreply.github.com`;
  const existing = users.find((user) => user.githubId === githubId || user.email === primaryEmail.toLowerCase());

  if (existing) {
    existing.githubId = githubId;
    existing.displayName = existing.displayName || profile.name || profile.login || existing.displayName;
    existing.email = primaryEmail.toLowerCase();
    existing.avatarUrl = profile.avatar_url || existing.avatarUrl || '';
    existing.githubLogin = profile.login || existing.githubLogin || '';
    existing.githubProfileUrl = profile.html_url || existing.githubProfileUrl || '';
    existing.provider = resolveProvider(existing);
    existing.role = existing.role || 'member';
    await writeUsers(users);
    return sanitizeUser(existing);
  }

  const requestedDisplayName = validateDisplayName(profile.name || profile.login || 'GitHub User', primaryEmail.toLowerCase());
  let uniqueDisplayName = requestedDisplayName;
  if (users.some((user) => normalizeDisplayName(user.displayName) === normalizeDisplayName(uniqueDisplayName))) {
    uniqueDisplayName = validateDisplayName(profile.login || requestedDisplayName, primaryEmail.toLowerCase());
  }
  if (users.some((user) => normalizeDisplayName(user.displayName) === normalizeDisplayName(uniqueDisplayName))) {
    uniqueDisplayName = `${uniqueDisplayName}-${githubId.slice(-4)}`;
  }

  const user = {
    id: randomUUID(),
    email: primaryEmail.toLowerCase(),
    displayName: uniqueDisplayName,
    provider: 'github',
    role: shouldGrantConfiguredAdmin(primaryEmail) ? 'admin' : 'member',
    githubId,
    avatarUrl: profile.avatar_url || '',
    githubLogin: profile.login || '',
    githubProfileUrl: profile.html_url || '',
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  await writeUsers(users);
  return sanitizeUser(user);
}

export async function fetchGitHubProfileFromCode({ code, request }) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('缺少 GitHub OAuth 环境变量');
  }

  const redirectUri = `${getBaseUrl(request)}/api/auth/github/callback`;
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenPayload = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new Error('GitHub 登录失败');
  }

  const profileResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'nima-tech-space',
    },
  });

  const profile = await profileResponse.json();
  if (!profileResponse.ok || !profile.id) {
    throw new Error('无法获取 GitHub 用户信息');
  }

  return profile;
}

export async function loginWithGitHubCode({ code, request }) {
  const profile = await fetchGitHubProfileFromCode({ code, request });
  return upsertGitHubUser(profile);
}

export async function linkGitHubToExistingUser({ userId, code, request }) {
  const profile = await fetchGitHubProfileFromCode({ code, request });
  const users = await getUsers();
  const githubId = String(profile.id);
  const index = users.findIndex((user) => user.id === userId);

  if (index < 0) {
    throw new Error('当前账号不存在');
  }

  const duplicate = users.find((user) => user.githubId === githubId && user.id !== userId);
  if (duplicate) {
    throw new Error('这个 GitHub 账号已经绑定到其他用户');
  }

  users[index] = {
    ...users[index],
    githubId,
    avatarUrl: profile.avatar_url || users[index].avatarUrl || '',
    githubLogin: profile.login || users[index].githubLogin || '',
    githubProfileUrl: profile.html_url || users[index].githubProfileUrl || '',
    provider: resolveProvider({
      ...users[index],
      githubId,
    }),
  };

  await writeUsers(users);
  return sanitizeUser(users[index]);
}

export function sha1(value) {
  return createHash('sha1').update(value).digest('hex');
}

export function hasRole(user, roles) {
  if (!user) return false;
  return roles.includes(user.role || 'member');
}

export function isAdmin(user) {
  return hasRole(user, ['admin']);
}

export function canManageApps(user) {
  return hasRole(user, ['admin', 'editor']);
}
