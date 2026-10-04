const { request } = require('./request');
const { getToken, getRefreshToken, setToken, setRefreshToken, setUserInfo, clearAuth } = require('./storage');

function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({ success: resolve, fail: reject });
  });
}

/** 微信登录：换取后端令牌 */
async function login() {
  const { code } = await wxLogin();
  if (!code) {
    throw new Error('未获取到微信登录 code');
  }

  const result = await request({
    url: '/auth/login',
    method: 'POST',
    data: { code },
    silent: true,
  });

  setToken(result.token);
  setRefreshToken(result.refreshToken);
  setUserInfo(result.userInfo);

  return result;
}

/** 确保已登录：已有令牌直接返回，否则重新登录 */
async function ensureLogin() {
  if (getToken()) {
    return { token: getToken() };
  }
  return login();
}

/** 刷新令牌，失败则重新登录 */
async function refreshToken() {
  const refresh = getRefreshToken();
  if (!refresh) {
    return login();
  }

  try {
    const result = await request({
      url: '/auth/refresh',
      method: 'POST',
      data: { refreshToken: refresh },
      silent: true,
    });
    setToken(result.token);
    setRefreshToken(result.refreshToken);
    return result;
  } catch (error) {
    clearAuth();
    return login();
  }
}

module.exports = { login, ensureLogin, refreshToken };
