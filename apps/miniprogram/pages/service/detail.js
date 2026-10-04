const { request } = require('../../utils/request');
const { fenToYuan } = require('../../utils/format');

Page({
  data: {
    loading: true,
    service: null,
    skuId: '',
    addons: [],
    estimate: '0',
    durationMinutes: 0,
  },

  onLoad(options) {
    this.serviceId = options.id;
    this.loadDetail();
  },

  async loadDetail() {
    try {
      const service = await request({ url: `/services/${this.serviceId}` });
      const skus = (service.skus || []).map((sku) =>
        Object.assign({}, sku, { priceLabel: fenToYuan(sku.price) }),
      );
      const defaultSku = skus.find((sku) => sku.isDefault) || skus[0] || null;
      const addons = (service.addons || []).map((addon) =>
        Object.assign({}, addon, {
          checked: false,
          quantity: 1,
          priceLabel: fenToYuan(addon.price),
        }),
      );

      this.setData(
        {
          service: Object.assign({}, service, { skus }),
          skuId: defaultSku ? defaultSku.id : '',
          addons,
        },
        () => this.recalculate(),
      );
    } catch (error) {
      wx.showToast({ title: '服务加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onSelectSku(event) {
    this.setData({ skuId: event.currentTarget.dataset.id }, () => this.recalculate());
  },

  onToggleAddon(event) {
    const id = event.currentTarget.dataset.id;
    const addons = this.data.addons.map((addon) =>
      addon.id === id ? Object.assign({}, addon, { checked: !addon.checked }) : addon,
    );
    this.setData({ addons }, () => this.recalculate());
  },

  /** 前端仅做预估展示，最终价格以服务端 /price/calculate 为准 */
  recalculate() {
    const { service, skuId, addons } = this.data;
    if (!service) {
      return;
    }

    const sku = (service.skus || []).find((item) => item.id === skuId);
    let total = sku ? sku.price : 0;
    let duration = sku ? sku.durationMinutes : 0;

    addons.forEach((addon) => {
      if (addon.checked) {
        total += addon.price * addon.quantity;
        duration += (addon.durationMinutes || 0) * addon.quantity;
      }
    });

    this.setData({ estimate: fenToYuan(total), durationMinutes: duration });
  },

  onBook() {
    if (!this.data.skuId) {
      wx.showToast({ title: '请选择服务规格', icon: 'none' });
      return;
    }

    const addonIds = this.data.addons
      .filter((addon) => addon.checked)
      .map((addon) => addon.id)
      .join(',');

    wx.navigateTo({
      url: `/pages/order/create?serviceId=${this.serviceId}&skuId=${this.data.skuId}&addonIds=${addonIds}`,
    });
  },
});
