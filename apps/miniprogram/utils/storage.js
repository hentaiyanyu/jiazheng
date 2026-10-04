const TOKEN_KEY = 'hc_token';
const REFRESH_TOKEN_KEY = 'hc_refresh_token';
const USER_INFO_KEY = 'hc_user_info';
const STAFF_TOKEN_KEY = 'hc_staff_token';
const STAFF_INFO_KEY = 'hc_staff_info';

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || '';
}

function setToken(token) {
  wx.setStorageSync(TOKEN_KEY, token || '');
}

function getRefreshToken() {
  return wx.getStorageSync(REFRESH_TOKEN_KEY) || '';
}

function setRefreshToken(token) {
  wx.setStorageSync(REFRESH_TOKEN_KEY, token || '');
}

function getUserInfo() {
  return wx.getStorageSync(USER_INFO_KEY) || null;
}

function setUserInfo(userInfo) {
  wx.setStorageSync(USER_INFO_KEY, userInfo || null);
}

function clearAuth() {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(REFRESH_TOKEN_KEY);
  wx.removeStorageSync(USER_INFO_KEY);
}

function getStaffToken() {
  return wx.getStorageSync(STAFF_TOKEN_KEY) || '';
}

function setStaffToken(token) {
  wx.setStorageSync(STAFF_TOKEN_KEY, token || '');
}

function getStaffInfo() {
  return wx.getStorageSync(STAFF_INFO_KEY) || null;
}

function setStaffInfo(info) {
  wx.setStorageSync(STAFF_INFO_KEY, info || null);
}

function clearStaffAuth() {
  wx.removeStorageSync(STAFF_TOKEN_KEY);
  wx.removeStorageSync(STAFF_INFO_KEY);
}

module.exports = {
  getToken,
  setToken,
  getRefreshToken,
  setRefreshToken,
  getUserInfo,
  setUserInfo,
  clearAuth,
  getStaffToken,
  setStaffToken,
  getStaffInfo,
  setStaffInfo,
  clearStaffAuth,
};
