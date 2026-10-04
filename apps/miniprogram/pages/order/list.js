const { request } = require('../../utils/request');
const { fenToYuan } = require('../../utils/format');

const TABS = [
  { key: '', label: '全部' },
  { key: 'PENDING_PAYMENT', label: '待支付' },
  { key: 'PENDING_DISPATCH', label: '待派单' },
  { key: 'PENDING_SERVICE', label: '待服务' },
  { key: 'COMPLETED', label: '已完成' },
];

Page({
  data: {
    tabs: TABS,
    activeTab: '',
    list: [],
    loading: true,
  },

  onShow() {
    this.loadList();
  },

  onPullDownRefresh() {
    this.loadList().finally(() => wx.stopPullDownRefresh());
  },

  async loadList() {
    const query = { page: 1, pageSize: 20 };
    if (this.data.activeTab) {
      query.status = this.data.activeTab;
    }

    try {
      const result = await request({ url: '/orders', data: query, silent: true });
      const list = (result.list || []).map((order) =>
        Object.assign({}, order, {
          serviceName: order.service ? order.service.name : '',
          skuName: order.service ? order.service.skuName : '',
          addressText: order.address
            ? `${order.address.district || ''}${order.address.detail || ''}`
            : '',
          payableText: fenToYuan(order.amount.payable),
          canPay: order.status === 'PENDING_PAYMENT',
        }),
      );
      this.setData({ list });
    } catch (error) {
      console.warn('[order] 列表加载失败', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  onTabChange(event) {
    const key = event.currentTarget.dataset.key || '';
    if (key === this.data.activeTab) {
      return;
    }
    this.setData({ activeTab: key }, () => this.loadList());
  },

  onTapOrder(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/order/detail?id=${id}` });
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/home/index' });
  },
});
