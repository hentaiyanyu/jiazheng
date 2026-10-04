const { request } = require('../../utils/request');
const {
  getStaffToken,
  setStaffToken,
  getStaffInfo,
  setStaffInfo,
  clearStaffAuth,
} = require('../../utils/storage');
const { fenToYuan } = require('../../utils/format');
const { DEV_MODE } = require('../../config/index');
const { uploadFile, uploadFiles, takePhoto, takePhotos } = require('../../utils/upload');
const { requestSubscribe } = require('../../utils/subscribe');

const TABS = [
  { key: 'PENDING', label: '待接单' },
  { key: 'SERVING', label: '服务中' },
  { key: 'FINISHED', label: '已完成' },
];

Page({
  data: {
    loggedIn: false,
    staffInfo: null,
    tabs: TABS,
    activeTab: 'PENDING',
    list: [],
    loading: true,
    unread: 0,
  },

  onShow() {
    if (getStaffToken()) {
      this.setData({ loggedIn: true, staffInfo: getStaffInfo() });
      this.loadProfile();
      this.loadTasks();
      this.loadUnread();
      this.startPolling();
    } else {
      this.setData({ loggedIn: false, loading: false });
    }
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  // 新派单会随时到达，页面停留期间轮询刷新
  startPolling() {
    this.stopPolling();

    this.timer = setInterval(() => {
      if (getStaffToken()) {
        // 评分会随用户评价变化，一并刷新
        this.loadProfile();
        this.loadTasks(true);
      }
    }, 15000);
  },

  // 拉取最新资料（评分、累计单量会随评价与完工变化）
  async loadProfile() {
    try {
      const profile = await request({
        url: '/staff/profile',
        role: 'staff',
        silent: true,
      });

      setStaffInfo(profile);
      this.setData({ staffInfo: profile });
    } catch (error) {
      // 静默失败，不打扰正在工作的保洁师
    }
  },

  // 未读消息数
  async loadUnread() {
    try {
      const result = await request({
        url: '/notifications/unread-count',
        role: 'staff',
        silent: true,
      });
      this.setData({ unread: result.unread || 0 });
    } catch (error) {
      // 忽略
    }
  },

  onGoMessage() {
    wx.navigateTo({ url: '/pages/message/list?role=staff' });
  },

  stopPolling() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  onLogin() {
    wx.showModal({
      title: '保洁师登录',
      editable: true,
      placeholderText: '开发登录码，如 staff_dev001',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        const code = (res.content || '').trim();
        if (!code) {
          wx.showToast({ title: '请输入登录码', icon: 'none' });
          return;
        }

        try {
          const result = await request({
            url: '/staff/auth/login',
            method: 'POST',
            data: { code },
            silent: true,
            role: 'staff',
          });

          setStaffToken(result.token);
          setStaffInfo(result.staffInfo);
          this.setData({ loggedIn: true, staffInfo: result.staffInfo });
          this.loadTasks();
        } catch (error) {
          wx.showModal({
            title: '登录失败',
            content: (error && error.message) || '未知错误',
            showCancel: false,
          });
        }
      },
    });
  },

  onLogout() {
    clearStaffAuth();
    this.setData({ loggedIn: false, staffInfo: null, list: [], loading: false });
  },

  async loadTasks(silent) {
    if (!silent) {
      this.setData({ loading: true });
    }

    try {
      const list = await request({
        url: '/staff/tasks',
        data: { tab: this.data.activeTab },
        role: 'staff',
        silent: true,
      });

      this.setData({
        list: (list || []).map((order) => {
          const actions = order.actions || [];
          return Object.assign({}, order, {
            serviceName: order.service ? order.service.name : '',
            skuName: order.service ? order.service.skuName : '',
            addressText: order.address
              ? `${order.address.district || ''}${order.address.detail || ''}`
              : '',
            payableText: fenToYuan(order.amount.payable),
            canAccept: actions.indexOf('ACCEPT') >= 0,
            canReject: actions.indexOf('REJECT') >= 0,
            canDepart: actions.indexOf('DEPART') >= 0,
            canCheckin: actions.indexOf('CHECKIN') >= 0,
            canFinish: actions.indexOf('FINISH') >= 0,
          });
        }),
      });
    } catch (error) {
      console.warn('[staff] 任务加载失败', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  onTabChange(event) {
    const key = event.currentTarget.dataset.key;
    if (key === this.data.activeTab) {
      return;
    }
    this.setData({ activeTab: key }, () => this.loadTasks());
  },

  onOpenTask(event) {
    const orderId = event.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/staff/detail?orderId=${orderId}` });
  },

  async act(orderId, action, data) {
    try {
      await request({
        url: `/staff/tasks/${orderId}/${action}`,
        method: 'POST',
        data: data || {},
        role: 'staff',
        silent: true,
      });
      wx.showToast({ title: '操作成功', icon: 'success' });
      this.loadTasks();
      return null;
    } catch (error) {
      throw error;
    }
  },

  async onAccept(event) {
    const id = event.currentTarget.dataset.id;

    // 顺带申请订阅消息授权（用于发送新任务通知）
    await requestSubscribe(['DISPATCH']);

    try {
      await this.act(id, 'accept');
    } catch (error) {
      wx.showModal({ title: '接单失败', content: (error && error.message) || '未知错误', showCancel: false });
    }
  },

  onReject(event) {
    const id = event.currentTarget.dataset.id;
    wx.showModal({
      title: '拒单原因',
      editable: true,
      placeholderText: '例如：时间冲突',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        const reason = (res.content || '').trim();

        // 拒单原因必填：会记录到派单记录，供运营分析
        if (!reason) {
          wx.showModal({
            title: '请填写拒单原因',
            content: '拒单原因会记录在派单记录中，用于后续优化派单。',
            showCancel: false,
            success: () => this.onReject(event),
          });
          return;
        }

        try {
          await this.act(id, 'reject', { reason });
        } catch (error) {
          wx.showModal({ title: '拒单失败', content: (error && error.message) || '未知错误', showCancel: false });
        }
      },
    });
  },

  // 到店拍照打卡：先拍照上传，再带定位签到
  async onPhotoCheckin(event) {
    const id = event.currentTarget.dataset.id;
    const order = this.data.list.find((item) => item.orderId === id);

    let filePath = '';
    try {
      filePath = await takePhoto();
    } catch (error) {
      return;
    }

    wx.showLoading({ title: '上传照片', mask: true });

    let imageUrl = '';
    try {
      const uploaded = await uploadFile(filePath, { role: 'staff' });
      imageUrl = uploaded.url;
    } catch (error) {
      wx.hideLoading();
      wx.showModal({
        title: '照片上传失败',
        content: (error && error.message) || '未知错误',
        showCancel: false,
      });
      return;
    }

    wx.hideLoading();

    wx.getLocation({
      type: 'gcj02',
      success: async (location) => {
        try {
          await this.act(id, 'checkin', {
            lng: location.longitude,
            lat: location.latitude,
            image: imageUrl,
          });
        } catch (error) {
          const canMock = DEV_MODE && error && error.code === 40908 && order && order.address;

          if (!canMock) {
            wx.showModal({ title: '签到失败', content: (error && error.message) || '未知错误', showCancel: false });
            return;
          }

          wx.showModal({
            title: '签到位置不符',
            content: `${error.message}\n\n开发模式下可按服务地址坐标模拟签到（正式环境不会有这个选项）。`,
            confirmText: '模拟签到',
            success: async (res) => {
              if (!res.confirm) {
                return;
              }
              try {
                await this.act(id, 'checkin', {
                  lng: order.address.lng,
                  lat: order.address.lat,
                  image: imageUrl,
                });
              } catch (innerError) {
                wx.showModal({
                  title: '签到失败',
                  content: (innerError && innerError.message) || '未知错误',
                  showCancel: false,
                });
              }
            },
          });
        }
      },
      fail: () => {
        wx.showModal({
          title: '无法获取位置',
          content: '请在开发者工具中允许位置权限后重试。',
          showCancel: false,
        });
      },
    });
  },

  async onFinish(event) {
    const id = event.currentTarget.dataset.id;

    let filePaths = [];

    try {
      // 最多 4 张：厨房、卫生间、客厅、整体
      filePaths = await takePhotos(4);
    } catch (error) {
      return;
    }

    if (!filePaths || filePaths.length === 0) {
      wx.showToast({ title: '请至少拍一张完工照片', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '上传照片', mask: true });

    let urls = [];
    try {
      urls = await uploadFiles(filePaths, { role: 'staff' });
    } catch (error) {
      wx.hideLoading();
      wx.showModal({
        title: '照片上传失败',
        content: (error && error.message) || '未知错误',
        showCancel: false,
      });
      return;
    }

    wx.hideLoading();

    try {
      await this.act(id, 'finish', {
        images: urls,
        remark: `完工上报，共 ${urls.length} 张照片`,
      });
    } catch (error) {
      wx.showModal({ title: '提交失败', content: (error && error.message) || '未知错误', showCancel: false });
    }
  },
});
