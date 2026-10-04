const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');
const { fenToYuan, fenToYuanSigned, buildDateOptions, maskPhone } = require('../../utils/format');
const { DEFAULT_DISTRICT_CODE } = require('../../config/index');
const { requestSubscribe } = require('../../utils/subscribe');

Page({
  data: {
    loading: true,
    serviceId: '',
    skuId: '',
    addonIds: [],
    serviceName: '',
    skuName: '',
    addonNames: [],
    address: null,
    dateOptions: [],
    activeDate: '',
    slots: [],
    startTime: '',
    earliestAvailable: '',
    noSlotToday: false,
    price: null,
    requestId: '',
  },

  onLoad(options) {
    const addonIds = options.addonIds ? options.addonIds.split(',').filter(Boolean) : [];
    const dateOptions = buildDateOptions(7);

    this.setData({
      serviceId: options.serviceId || '',
      skuId: options.skuId || '',
      addonIds,
      dateOptions,
      activeDate: dateOptions.length > 0 ? dateOptions[0].value : '',
      // 幂等键：整个页面生命周期内不变，重复提交也只会产生一张订单
      requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    });

    this.init();
  },

  onShow() {
    // 从地址列表返回时同步选中的地址
    const app = getApp();
    const selectedId = app.globalData.selectedAddressId;

    if (selectedId && (!this.data.address || this.data.address.id !== selectedId)) {
      app.globalData.selectedAddressId = '';
      this.loadAddresses(selectedId);
    }
  },

  async init() {
    await ensureLogin().catch(() => {});
    await Promise.all([this.loadService(), this.loadAddresses()]);
    await Promise.all([this.loadSlots(), this.calculatePrice()]);
    this.setData({ loading: false });
  },

  async loadService() {
    try {
      const service = await request({ url: `/services/${this.data.serviceId}`, silent: true });
      const sku = (service.skus || []).find((item) => item.id === this.data.skuId);
      const addonNames = (service.addons || [])
        .filter((addon) => this.data.addonIds.indexOf(addon.id) >= 0)
        .map((addon) => addon.name);

      this.setData({
        serviceName: service.name,
        skuName: sku ? sku.name : '',
        addonNames,
      });
    } catch (error) {
      console.warn('[order] 服务信息加载失败', error);
    }
  },

  async loadAddresses(preferId) {
    try {
      const list = await request({ url: '/addresses', silent: true });
      let address = null;

      if (preferId) {
        address = list.find((item) => item.id === preferId) || null;
      }
      if (!address) {
        address = list.find((item) => item.isDefault) || list[0] || null;
      }

      if (address) {
        address.phoneText = maskPhone(address.contactPhone);
      }

      this.setData({ address }, () => this.calculatePrice());
    } catch (error) {
      console.warn('[order] 地址加载失败', error);
    }
  },

  async loadSlots() {
    if (!this.data.activeDate) {
      return;
    }

    const districtCode = this.data.address ? this.data.address.regionCode : DEFAULT_DISTRICT_CODE;

    try {
      const result = await request({
        url: '/time-slots',
        data: {
          serviceId: this.data.serviceId,
          skuId: this.data.skuId,
          date: this.data.activeDate,
          districtCode,
        },
        silent: true,
      });

      const slots = (result.slots || []).map((slot) =>
        Object.assign({}, slot, {
          tip: slot.available
            ? `余 ${slot.remaining}`
            : slot.reason === 'FULL'
            ? '已约满'
            : slot.reason === 'PAST'
            ? '已过时'
            : '不可约',
        }),
      );

      // 保留仍然可用的已选时段，否则清空
      const stillAvailable = slots.some(
        (slot) => slot.startTime === this.data.startTime && slot.available,
      );

      this.setData({ slots, startTime: stillAvailable ? this.data.startTime : '' });

      const hasAvailable = slots.some((slot) => slot.available);
      this.setData({
        earliestAvailable: result.earliestAvailable || '',
        noSlotToday: slots.length > 0 && !hasAvailable,
      });
    } catch (error) {
      this.setData({ slots: [] });
    }
  },

  async calculatePrice() {
    const { serviceId, skuId, addonIds, address, activeDate, startTime } = this.data;

    if (!address || !startTime || !serviceId || !skuId) {
      this.setData({ price: null });
      return;
    }

    try {
      const result = await request({
        url: '/price/calculate',
        method: 'POST',
        data: {
          serviceId,
          skuId,
          addons: addonIds.map((addonId) => ({ addonId, quantity: 1 })),
          addressId: address.id,
          serviceDate: activeDate,
          startTime,
        },
        silent: true,
      });

      this.setData({
        price: Object.assign({}, result, {
          payableText: fenToYuan(result.amountPayable),
          breakdown: (result.breakdown || []).map((item) =>
            Object.assign({}, item, { amountText: fenToYuanSigned(item.amount) }),
          ),
        }),
      });
    } catch (error) {
      this.setData({ price: null });
      if (error && error.message) {
        wx.showToast({ title: error.message, icon: 'none' });
      }
    }
  },

  onSelectDate(event) {
    const date = event.currentTarget.dataset.date;
    if (date === this.data.activeDate) {
      return;
    }
    this.setData({ activeDate: date, startTime: '' }, () => this.loadSlots());
  },

  onSelectSlot(event) {
    const time = event.currentTarget.dataset.time;
    const slot = this.data.slots.find((item) => item.startTime === time);
    if (!slot || !slot.available) {
      return;
    }
    this.setData({ startTime: time }, () => this.calculatePrice());
  },

  onChooseAddress() {
    wx.navigateTo({ url: '/pages/address/list?mode=select' });
  },

  async onSubmit() {
    const { address, startTime, price, serviceId, skuId, addonIds, activeDate, requestId } = this.data;

    if (!address) {
      wx.showToast({ title: '请先添加服务地址', icon: 'none' });
      return;
    }
    if (!startTime) {
      wx.showToast({ title: '请选择服务时间', icon: 'none' });
      return;
    }
    if (!price) {
      wx.showToast({ title: '价格计算中，请稍候', icon: 'none' });
      return;
    }
    if (this.submitting) {
      return;
    }

    this.submitting = true;

    // 顺带申请订阅消息授权（用于发送订单状态通知）
    await requestSubscribe(['ORDER_STATUS']);

    wx.showLoading({ title: '提交中', mask: true });

    try {
      const result = await request({
        url: '/orders',
        method: 'POST',
        data: {
          requestId,
          serviceId,
          skuId,
          addons: addonIds.map((addonId) => ({ addonId, quantity: 1 })),
          addressId: address.id,
          serviceDate: activeDate,
          startTime,
          expectedAmount: price.amountPayable,
        },
      });

      console.log('[order] 创建订单返回', result);
      wx.hideLoading();

      if (result.payParams && result.payParams.mock) {
        this.confirmMockPay(result);
        return;
      }

      if (!result.payParams || !result.payParams.timeStamp) {
        // 兜底：没有支付参数时直接进订单详情，避免"点了没反应"
        wx.showModal({
          title: '订单已创建',
          content: `订单号 ${result.orderNo}，未获取到支付参数，可稍后在订单列表继续支付。`,
          showCancel: false,
          success: () => wx.redirectTo({ url: `/pages/order/detail?id=${result.orderId}` }),
        });
        return;
      }

      wx.requestPayment({
        timeStamp: result.payParams.timeStamp,
        nonceStr: result.payParams.nonceStr,
        package: result.payParams.package,
        signType: result.payParams.signType,
        paySign: result.payParams.paySign,
        success: () => {
          wx.redirectTo({ url: `/pages/order/detail?id=${result.orderId}` });
        },
        fail: () => {
          wx.showToast({ title: '支付未完成，可稍后在订单中继续支付', icon: 'none' });
          wx.redirectTo({ url: `/pages/order/detail?id=${result.orderId}` });
        },
      });
    } catch (error) {
      wx.hideLoading();
      console.error('[order] 下单失败', error);

      // 时段已被占用：清空选择并刷新可用时段，避免用户反复试错
      if (error && error.code === 40901) {
        this.setData({ startTime: '', price: null }, () => this.loadSlots());
      }

      // 任何失败都必须给出可见反馈，避免"点击后无反应"
      const message =
        (error && (error.message || error.errMsg)) || '下单失败，请查看开发者工具 Console 的报错信息';

      wx.showModal({
        title: '下单失败',
        content: message,
        showCancel: false,
      });
    } finally {
      this.submitting = false;
    }
  },

  // 开发环境模拟支付
  confirmMockPay(result) {
    wx.showModal({
      title: '模拟支付',
      content: `订单 ${result.orderNo}\n应付 ¥${fenToYuan(result.amountPayable)}\n\n当前为开发模式，点击"模拟支付"即视为支付成功。（接入微信支付商户号后自动切换为真实支付）`,
      confirmText: '模拟支付',
      cancelText: '稍后支付',
      success: async (res) => {
        if (!res.confirm) {
          wx.redirectTo({ url: `/pages/order/detail?id=${result.orderId}` });
          return;
        }

        try {
          await request({
            url: '/payments/mock-pay',
            method: 'POST',
            data: { outTradeNo: result.orderNo },
          });
          wx.showToast({ title: '支付成功', icon: 'success' });
          setTimeout(() => wx.redirectTo({ url: `/pages/order/detail?id=${result.orderId}` }), 800);
        } catch (error) {
          console.warn('[order] 模拟支付失败', error);
        }
      },
    });
  },
});
