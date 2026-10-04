const { ensureLogin } = require('./utils/auth');

App({
  globalData: {
    userInfo: null,
  },

  onLaunch() {
    // 静默登录：用户无感知地建立登录态，失败也不阻塞浏览
    ensureLogin().catch((error) => {
      console.warn('[app] 静默登录失败，可稍后重试', error);
    });
  },
});
