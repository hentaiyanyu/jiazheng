const { request } = require('../../utils/request');
const { maskPhone } = require('../../utils/format');

Page({
  data: {
    list: [],
    mode: '',
    loading: true,
  },

  onLoad(options) {
    this.setData({ mode: options.mode || '' });
  },

  onShow() {
    this.loadList();
  },

  async loadList() {
    try {
      const list = await request({ url: '/addresses', silent: true });
      this.setData({
        list: (list || []).map((item) =>
          Object.assign({}, item, { phoneText: maskPhone(item.contactPhone) }),
        ),
      });
    } catch (error) {
      console.warn('[address] 加载失败', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  onSelect(event) {
    if (this.data.mode !== 'select') {
      return;
    }

    const id = event.currentTarget.dataset.id;
    getApp().globalData.selectedAddressId = id;
    wx.navigateBack();
  },

  async onSetDefault(event) {
    const id = event.currentTarget.dataset.id;
    try {
      await request({ url: `/addresses/${id}/default`, method: 'POST' });
      this.loadList();
    } catch (error) {
      console.warn('[address] 设置默认失败', error);
    }
  },

  onEdit(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/address/edit?id=${id}` });
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/address/edit' });
  },

  onDelete(event) {
    const id = event.currentTarget.dataset.id;
    wx.showModal({
      title: '删除地址',
      content: '确定要删除这个地址吗？',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        try {
          await request({ url: `/addresses/${id}`, method: 'DELETE' });
          this.loadList();
        } catch (error) {
          console.warn('[address] 删除失败', error);
        }
      },
    });
  },
});
