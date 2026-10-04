/**
 * 全局配置
 *
 * 本地开发：后端跑在 http://localhost:3000
 * 需要在微信开发者工具中勾选「详情 - 本地设置 - 不校验合法域名」
 */
module.exports = {
  // 接口地址前缀
  BASE_URL: 'http://localhost:3000/api/v1',

  // 小程序名称（用于页面标题等）
  APP_NAME: '家政清洁服务',

  // 默认城市（开发阶段固定上海）
  DEFAULT_CITY_CODE: '310000',
  DEFAULT_DISTRICT_CODE: '310115',

  // 开发模式：开启后提供一些便于联调的兜底（例如签到距离校验的模拟位置）
  DEV_MODE: true,

  // 微信订阅消息模板 ID（在小程序后台申请后填入，留空则只发站内消息）
  SUBSCRIBE_TEMPLATES: {
    ORDER_STATUS: '',
    DISPATCH: '',
  },
};
