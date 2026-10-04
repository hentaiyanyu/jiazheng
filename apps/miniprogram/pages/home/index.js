const { request } = require('../../utils/request');
const { fenToYuan } = require('../../utils/format');

Page({
  data: {
    categories: [],
    services: [],
    activeCategoryId: '',
    loading: true,
  },

  onLoad() {
    this.loadCategories();
    this.loadServices();
  },

  onPullDownRefresh() {
    Promise.all([this.loadCategories(), this.loadServices()]).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadCategories() {
    try {
      const categories = await request({ url: '/categories', silent: true });
      this.setData({ categories: categories || [] });
    } catch (error) {
      console.warn('[home] 分类加载失败', error);
    }
  },

  async loadServices() {
    this.setData({ loading: true });

    const query = { page: 1, pageSize: 20 };
    if (this.data.activeCategoryId) {
      query.categoryId = this.data.activeCategoryId;
    }

    try {
      const result = await request({ url: '/services', data: query, silent: true });
      const services = (result.list || []).map((item) =>
        Object.assign({}, item, { priceFrom: fenToYuan(item.priceMin) }),
      );
      this.setData({ services });
    } catch (error) {
      wx.showToast({ title: '加载失败，请确认后端已启动', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onSelectCategory(event) {
    const id = event.currentTarget.dataset.id || '';
    if (id === this.data.activeCategoryId) {
      return;
    }
    this.setData({ activeCategoryId: id }, () => this.loadServices());
  },

  onTapService(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/service/detail?id=${id}` });
  },
});
