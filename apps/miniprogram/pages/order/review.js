const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');

const TAG_OPTIONS = ['准时到达', '服务专业', '态度好', '打扫干净', '沟通顺畅', '物超所值'];

Page({
  data: {
    orderId: '',
    order: null,
    score: 5,
    starOptions: [1, 2, 3, 4, 5],
    tags: [],
    content: '',
    isAnonymous: false,
    submitting: false,
  },

  onLoad(options) {
    this.setData({
      orderId: options.orderId || '',
      tags: TAG_OPTIONS.map((name) => ({ name, checked: false })),
    });

    ensureLogin().catch(() => {});
    this.loadOrder();
  },

  async loadOrder() {
    try {
      const order = await request({ url: `/orders/${this.data.orderId}`, silent: true });
      this.setData({ order });
    } catch (error) {
      console.warn('[review] 订单加载失败', error);
    }
  },

  onSelectScore(event) {
    this.setData({ score: Number(event.currentTarget.dataset.score) });
  },

  onToggleTag(event) {
    const name = event.currentTarget.dataset.name;
    this.setData({
      tags: this.data.tags.map((tag) =>
        tag.name === name ? Object.assign({}, tag, { checked: !tag.checked }) : tag,
      ),
    });
  },

  onInput(event) {
    this.setData({ content: event.detail.value });
  },

  onAnonymousChange(event) {
    this.setData({ isAnonymous: event.detail.value });
  },

  async onSubmit() {
    if (this.data.submitting) {
      return;
    }

    const selectedTags = this.data.tags.filter((tag) => tag.checked).map((tag) => tag.name);

    this.setData({ submitting: true });

    try {
      await request({
        url: '/reviews',
        method: 'POST',
        data: {
          orderId: this.data.orderId,
          score: this.data.score,
          tags: selectedTags,
          content: this.data.content.trim(),
          isAnonymous: this.data.isAnonymous,
        },
      });

      wx.showToast({ title: '评价已提交', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (error) {
      wx.showModal({
        title: '提交失败',
        content: (error && error.message) || '未知错误',
        showCancel: false,
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
