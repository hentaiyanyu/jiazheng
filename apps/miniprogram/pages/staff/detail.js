const { request } = require('../../utils/request');
const { fenToYuan } = require('../../utils/format');
const { DEV_MODE } = require('../../config/index');
const {
  uploadFile,
  uploadFiles,
  takePhoto,
  takePhotos,
  toAbsoluteUrl,
} = require('../../utils/upload');
const { requestSubscribe } = require('../../utils/subscribe');

const STATUS_TEXT = {
  PENDING_ACCEPT: '待接单',
  PENDING_SERVICE: '待服务',
  IN_SERVICE: '服务中',
  PENDING_CONFIRM: '待确认',
  COMPLETED: '已完成',
  CANCELED: '已取消',
  EXCEPTION: '异常',
};

Page({
  data: {
    loading: true,
    task: null,
    payableText: '0',
    incomeText: '0',
    statusText: '',
    canAccept: false,
    canReject: false,
    canDepart: false,
    canCheckin: false,
    canFinish: false,
    checkinPhoto: '',
    finishPhotos: [],
  },

  onLoad(options) {
    this.orderId = options.orderId;
  },

  onShow() {
    this.loadDetail();
  },

  async loadDetail() {
    try {
      const task = await request({
        url: `/staff/tasks/${this.orderId}`,
        role: 'staff',
        silent: true,
      });

      const actions = task.actions || [];
      const images = task.images || { checkin: null, finish: [] };
      const finishPhotos = (images.finish || []).map((url) => toAbsoluteUrl(url));

      this.setData({
        task,
        payableText: fenToYuan(task.amount.payable),
        incomeText: fenToYuan(task.estimatedIncome),
        statusText: STATUS_TEXT[task.status] || task.statusText,
        canAccept: actions.indexOf('ACCEPT') >= 0,
        canReject: actions.indexOf('REJECT') >= 0,
        canDepart: actions.indexOf('DEPART') >= 0,
        canCheckin: actions.indexOf('CHECKIN') >= 0,
        canFinish: actions.indexOf('FINISH') >= 0,
        checkinPhoto: images.checkin ? toAbsoluteUrl(images.checkin) : '',
        finishPhotos,
      });
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

  async act(action, data) {
    try {
      await request({
        url: `/staff/tasks/${this.orderId}/${action}`,
        method: 'POST',
        data: data || {},
        role: 'staff',
        silent: true,
      });
      wx.showToast({ title: '操作成功', icon: 'success' });
      this.loadDetail();
    } catch (error) {
      throw error;
    }
  },

  async onAccept() {
    // 顺带申请订阅消息授权（用于发送新任务通知）
    await requestSubscribe(['DISPATCH']);

    try {
      await this.act('accept');
    } catch (error) {
      wx.showModal({ title: '接单失败', content: (error && error.message) || '未知错误', showCancel: false });
    }
  },

  onReject() {
    wx.showModal({
      title: '拒单原因',
      editable: true,
      placeholderText: '例如：时间冲突',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        const reason = (res.content || '').trim();

        if (!reason) {
          wx.showModal({
            title: '请填写拒单原因',
            content: '拒单原因会记录在派单记录中，用于后续优化派单。',
            showCancel: false,
            success: () => this.onReject(),
          });
          return;
        }

        try {
          await this.act('reject', { reason });
        } catch (error) {
          wx.showModal({ title: '拒单失败', content: (error && error.message) || '未知错误', showCancel: false });
        }
      },
    });
  },

  // 到店拍照打卡：先拍照上传，再带定位签到
  async onPhotoCheckin() {
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
          await this.act('checkin', {
            lng: location.longitude,
            lat: location.latitude,
            image: imageUrl,
          });
        } catch (error) {
          const snapshot = this.data.task ? this.data.task.address : null;
          const canMock = DEV_MODE && error && error.code === 40908 && snapshot;

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
                await this.act('checkin', { lng: snapshot.lng, lat: snapshot.lat, image: imageUrl });
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

  async onFinish() {
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
      await this.act('finish', {
        images: urls,
        remark: `完工上报，共 ${urls.length} 张照片`,
      });
    } catch (error) {
      wx.showModal({ title: '提交失败', content: (error && error.message) || '未知错误', showCancel: false });
    }
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
});
