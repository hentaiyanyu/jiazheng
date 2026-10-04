const { request } = require('../../utils/request');

Page({
  data: {
    role: 'user',
    list: [],
    loading: true,
  },

  onLoad(options) {
    this.setData({ role: options.role === 'staff' ? 'staff' : 'user' });
  },

  onShow() {
    this.loadList();
  },

  onPullDownRefresh() {
    this.loadList().finally(() => wx.stopPullDownRefresh());
  },

  async loadList() {
    try {
      const result = await request({
        url: '/notifications',
        data: { page: 1, pageSize: 30 },
        role: this.data.role,
        silent: true,
      });

      this.setData({ list: result.list || [] });
    } catch (error) {
      console.warn('[message] 加载失败', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  async onTapItem(event) {
    const id = event.currentTarget.dataset.id;
    const page = event.currentTarget.dataset.page;

    // 点击即标记已读
    try {
      await request({
        url: '/notifications/read',
        method: 'POST',
        data: { id },
        role: this.data.role,
        silent: true,
      });

      this.setData({
        list: this.data.list.map((item) =>
          item.id === id ? Object.assign({}, item, { isRead: true }) : item,
        ),
      });
    } catch (error) {
      // 标记失败不影响跳转
    }

    if (page) {
      wx.navigateTo({ url: page, fail: () => undefined });
    }
  },
});
