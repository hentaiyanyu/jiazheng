const { request } = require('../../utils/request');
const { buildDateOptions } = require('../../utils/format');

Page({
  data: {
    orderId: '',
    order: null,
    dateOptions: [],
    activeDate: '',
    slots: [],
    startTime: '',
    submitting: false,
    loading: true,
  },

  onLoad(options) {
    const dateOptions = buildDateOptions(7);

    this.setData({
      orderId: options.orderId || '',
      dateOptions,
      activeDate: dateOptions.length > 0 ? dateOptions[0].value : '',
    });

    this.loadOrder();
  },

  async loadOrder() {
    try {
      const order = await request({ url: `/orders/${this.data.orderId}`, silent: true });
      this.setData({ order });
      await this.loadSlots();
    } catch (error) {
      wx.showModal({
        title: '加载失败',
        content: (error && error.message) || '未知错误',
        showCancel: false,
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadSlots() {
    const { order, activeDate } = this.data;
    if (!order || !activeDate) {
      return;
    }

    try {
      const result = await request({
        url: '/time-slots',
        data: {
          serviceId: order.service.serviceId,
          skuId: order.service.skuId,
          date: activeDate,
          districtCode: order.districtCode,
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

      const stillAvailable = slots.some(
        (slot) => slot.startTime === this.data.startTime && slot.available,
      );

      this.setData({ slots, startTime: stillAvailable ? this.data.startTime : '' });
    } catch (error) {
      this.setData({ slots: [] });
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
    this.setData({ startTime: time });
  },

  async onSubmit() {
    const { startTime, activeDate, orderId } = this.data;

    if (!startTime) {
      wx.showToast({ title: '请选择新的服务时间', icon: 'none' });
      return;
    }
    if (this.data.submitting) {
      return;
    }

    this.setData({ submitting: true });

    try {
      await request({
        url: `/orders/${orderId}/reschedule`,
        method: 'POST',
        data: { serviceDate: activeDate, startTime },
      });

      wx.showToast({ title: '改期成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 900);
    } catch (error) {
      // 时段被占用时刷新列表
      if (error && error.code === 40901) {
        this.setData({ startTime: '' }, () => this.loadSlots());
      }

      wx.showModal({
        title: '改期失败',
        content: (error && error.message) || '未知错误',
        showCancel: false,
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
