const { SUBSCRIBE_TEMPLATES } = require('../config/index');

/**
 * 申请订阅消息授权
 *
 * 微信订阅消息是「一次性」的：用户每授权一次，平台才能发一条。
 * 因此在关键动作（下单、接单）时顺带申请，授权失败也不影响主流程。
 * 未配置模板 ID 时直接跳过（开发阶段）。
 */
function requestSubscribe(keys) {
  const tmplIds = (keys || [])
    .map((key) => SUBSCRIBE_TEMPLATES[key])
    .filter((id) => Boolean(id));

  if (tmplIds.length === 0) {
    return Promise.resolve({ skipped: true });
  }

  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds,
      success: resolve,
      fail: (error) => resolve({ error }),
    });
  });
}

module.exports = { requestSubscribe };
