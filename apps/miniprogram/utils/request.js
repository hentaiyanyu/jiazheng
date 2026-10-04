const { BASE_URL } = require('../config/index');
const { getToken, getStaffToken, clearAuth, clearStaffAuth } = require('./storage');

const AUTH_ERROR_CODES = [40100, 40101, 40102];

/**
 * 统一请求封装
 *
 * 用法：await request({ url: '/services', data: { page: 1 } })
 * 返回值：后端 data 字段（已剥掉 code/message/traceId 外层）
 */
function request(options) {
  const { url, method = 'GET', data = {}, silent = false, loading = false } = options;

  if (loading) {
    wx.showLoading({ title: '加载中', mask: true });
  }

  const isStaff = options.role === 'staff';
  const token = isStaff ? getStaffToken() : getToken();
  const header = { 'content-type': 'application/json' };
  if (token) {
    header.Authorization = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header,
      success(res) {
        const body = res.data || {};

        if (body.code === 0) {
          resolve(body.data);
          return;
        }

        // 登录态失效：清除本地令牌，提示重新进入
        if (AUTH_ERROR_CODES.indexOf(body.code) >= 0) {
          if (isStaff) {
            clearStaffAuth();
          } else {
            clearAuth();
          }
        }

        if (!silent) {
          wx.showToast({ title: body.message || '请求失败', icon: 'none' });
        }

        reject(body);
      },
      fail(error) {
        if (!silent) {
          wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
        }
        reject(error);
      },
      complete() {
        if (loading) {
          wx.hideLoading();
        }
      },
    });
  });
}

module.exports = { request };
