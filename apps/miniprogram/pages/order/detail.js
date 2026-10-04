const { request } = require('../../utils/request');
const { fenToYuan } = require('../../utils/format');
const { toAbsoluteUrl } = require('../../utils/upload');

Page({
  data: {
    loading: true,
    order: null,
    amountText: '0',
    canPay: false,
    canCancel: false,
    canConfirm: false,
    canRepeat: false,
    canReview: false,
    canReschedule: false,
    checkinPhoto: '',
    finishPhotos: [],
  },

  onLoad(options) {
    this.orderId = options.id;
  },

  onShow() {
    this.loadDetail();
    this.startPolling();
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  // 订单状态可能被保洁师或后台改变，页面停留期间轮询刷新
  startPolling() {
    this.stopPolling();

    this.timer = setInterval(() => {
      const order = this.data.order;
      const terminal = order && ['COMPLETED', 'CANCELED', 'REFUNDED'].indexOf(order.status) >= 0;

      if (!terminal) {
        this.loadDetail(true);
      }
    }, 8000);
  },

  stopPolling() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  async loadDetail(silent) {
    try {
      const order = await request({ url: `/orders/${this.orderId}`, silent: true });
      const actions = order.actions || [];
      const images = order.images || { checkin: null, finish: [] };
      const finishPhotos = (images.finish || []).map((url) => toAbsoluteUrl(url));

      this.setData({
        order,
        amountText: fenToYuan(order.amount.payable),
        canPay: actions.indexOf('PAY') >= 0,
        canCancel: actions.indexOf('CANCEL') >= 0,
        canConfirm: actions.indexOf('CONFIRM_FINISH') >= 0,
        canRepeat: actions.indexOf('REPEAT') >= 0,
        canReview: actions.indexOf('REVIEW') >= 0,
        canReschedule: actions.indexOf('RESCHEDULE') >= 0,
        checkinPhoto: images.checkin ? toAbsoluteUrl(images.checkin) : '',
        finishPhotos,
      });
    } catch (error) {
      // 轮询失败不打扰用户，仅首次加载提示
      if (!silent) {
        wx.showToast({ title: '订单加载失败', icon: 'none' });
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  async onPay() {
    const { order } = this.data;
    if (!order) {
      return;
    }

    wx.showLoading({ title: '发起支付', mask: true });

    try {
      const payParams = await request({
        url: '/payments/prepay',
        method: 'POST',
        data: { outTradeNo: order.orderNo },
      });

      wx.hideLoading();

      if (payParams.mock) {
        await request({
          url: '/payments/mock-pay',
          method: 'POST',
          data: { outTradeNo: order.orderNo },
        });
        wx.showToast({ title: '支付成功', icon: 'success' });
        setTimeout(() => this.loadDetail(), 800);
        return;
      }

      wx.requestPayment(
        Object.assign({}, payParams, {
          success: () => {
            wx.showToast({ title: '支付成功', icon: 'success' });
            setTimeout(() => this.loadDetail(), 800);
          },
          fail: () => {
            wx.showToast({ title: '支付未完成', icon: 'none' });
          },
        }),
      );
    } catch (error) {
      wx.hideLoading();
      console.warn('[order] 支付失败', error);
    }
  },

  onCancel() {
    wx.showModal({
      title: '取消订单',
      content:
        '取消规则：\n· 距服务开始超过 60 分钟：全额退款\n· 距服务开始不足 60 分钟：扣除 30 元上门费\n· 退款将原路返回，1-7 个工作日到账\n\n确定要取消吗？',
      confirmText: '确定取消',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        try {
          const result = await request({
            url: `/orders/${this.orderId}/cancel`,
            method: 'POST',
            data: { reason: '用户主动取消' },
          });

          let message = '订单已取消';

          if (result.requiresApproval) {
            message =
              `已取消，退款申请 ¥${fenToYuan(result.refundAmount)} 已提交。\n\n` +
              `规则：${result.refundRule || '需客服审批'}，客服会在 24 小时内处理。`;
          } else if (result.refunded) {
            message = `已取消，退款 ¥${fenToYuan(result.refundAmount)} 将原路返回`;
          } else if (result.refundRule) {
            message = `已取消（${result.refundRule}）`;
          }

          wx.showModal({
            title: '取消成功',
            content: message,
            showCancel: false,
            success: () => this.loadDetail(),
          });
        } catch (error) {
          console.warn('[order] 取消失败', error);
        }
      },
    });
  },

  // 去评价（订单完成后可评价，且未评价过）
  onReview() {
    wx.navigateTo({ url: `/pages/order/review?orderId=${this.orderId}` });
  },

  onReschedule() {
    wx.navigateTo({ url: `/pages/order/reschedule?orderId=${this.orderId}` });
  },

  onPreviewCheckin() {
    if (this.data.checkinPhoto) {
      wx.previewImage({ urls: [this.data.checkinPhoto] });
    }
  },

  onPreviewFinish(event) {
    const index = Number(event.currentTarget.dataset.index) || 0;
    if (this.data.finishPhotos.length > 0) {
      wx.previewImage({ urls: this.data.finishPhotos, current: this.data.finishPhotos[index] });
    }
  },

  async onConfirm() {
    try {
      await request({ url: `/orders/${this.orderId}/confirm`, method: 'POST' });
      wx.showToast({ title: '已确认完工', icon: 'success' });
      setTimeout(() => this.loadDetail(), 800);
    } catch (error) {
      console.warn('[order] 确认失败', error);
    }
  },

  async onRepeat() {
    try {
      const draft = await request({
        url: `/orders/${this.orderId}/repeat`,
        method: 'POST',
      });

      wx.navigateTo({
        url: `/pages/order/create?serviceId=${draft.serviceId}&skuId=${draft.skuId}&addonIds=${draft.addonIds.join(',')}`,
      });
    } catch (error) {
      console.warn('[order] 再来一单失败', error);
    }
  },
});
