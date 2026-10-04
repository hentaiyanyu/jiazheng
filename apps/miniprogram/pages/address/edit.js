const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');

// 与后端种子数据保持一致（Sprint 3 改为接口下发）
const DISTRICTS = [
  { code: '310115', name: '浦东新区', province: '上海市', city: '上海市' },
  { code: '310104', name: '徐汇区', province: '上海市', city: '上海市' },
  { code: '310101', name: '黄浦区', province: '上海市', city: '上海市' },
];

const DEFAULT_LOCATION = { lng: 121.5443, lat: 31.2261 };

Page({
  data: {
    id: '',
    districtNames: DISTRICTS.map((item) => item.name),
    districtIndex: 0,
    contactName: '',
    contactPhone: '',
    detail: '',
    floor: 1,
    hasElevator: true,
    tag: '',
    isDefault: false,
    lng: DEFAULT_LOCATION.lng,
    lat: DEFAULT_LOCATION.lat,
    saving: false,
  },

  onLoad(options) {
    ensureLogin().catch(() => {});

    if (options.id) {
      this.setData({ id: options.id });
      this.loadDetail(options.id);
    }
  },

  async loadDetail(id) {
    try {
      const list = await request({ url: '/addresses', silent: true });
      const address = (list || []).find((item) => item.id === id);
      if (!address) {
        return;
      }

      const districtIndex = Math.max(
        0,
        DISTRICTS.findIndex((item) => item.code === address.regionCode),
      );

      this.setData({
        districtIndex,
        contactName: address.contactName,
        contactPhone: address.contactPhone,
        detail: address.detail,
        floor: address.floor,
        hasElevator: address.hasElevator,
        tag: address.tag || '',
        isDefault: address.isDefault,
        lng: address.lng,
        lat: address.lat,
      });
    } catch (error) {
      console.warn('[address] 详情加载失败', error);
    }
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [field]: event.detail.value });
  },

  onDistrictChange(event) {
    this.setData({ districtIndex: Number(event.detail.value) });
  },

  onFloorChange(event) {
    this.setData({ floor: Number(event.detail.value) || 1 });
  },

  onElevatorChange(event) {
    this.setData({ hasElevator: event.detail.value });
  },

  onDefaultChange(event) {
    this.setData({ isDefault: event.detail.value });
  },

  onChooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          lng: res.longitude,
          lat: res.latitude,
          detail: this.data.detail || res.name || res.address || '',
        });
      },
      fail: () => {
        wx.showToast({ title: '未选择位置', icon: 'none' });
      },
    });
  },

  async onSave() {
    const { id, districtIndex, contactName, contactPhone, detail, floor, hasElevator, tag, isDefault, lng, lat } =
      this.data;

    if (!contactName.trim()) {
      wx.showToast({ title: '请填写联系人', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(contactPhone)) {
      wx.showToast({ title: '请填写正确的手机号', icon: 'none' });
      return;
    }
    if (!detail.trim()) {
      wx.showToast({ title: '请填写详细地址', icon: 'none' });
      return;
    }

    const district = DISTRICTS[districtIndex];
    const payload = {
      contactName: contactName.trim(),
      contactPhone,
      province: district.province,
      city: district.city,
      district: district.name,
      regionCode: district.code,
      detail: detail.trim(),
      lng,
      lat,
      floor,
      hasElevator,
      tag: tag || '家',
      isDefault,
    };

    this.setData({ saving: true });

    try {
      if (id) {
        await request({ url: `/addresses/${id}`, method: 'PUT', data: payload });
      } else {
        await request({ url: '/addresses', method: 'POST', data: payload });
      }

      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (error) {
      console.warn('[address] 保存失败', error);
    } finally {
      this.setData({ saving: false });
    }
  },
});
