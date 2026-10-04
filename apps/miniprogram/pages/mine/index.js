const { getUserInfo } = require('../../utils/storage');
const { maskPhone } = require('../../utils/format');
const { request } = require('../../utils/request');

Page({
  data: {
    userInfo: null,
    phoneText: '',
    unread: 0,
  },

  onShow() {
    const userInfo = getUserInfo();
    this.setData({
      userInfo,
      phoneText: userInfo ? maskPhone(userInfo.phone) : '',
    });

    this.loadUnread();
  },

  async loadUnread() {
    try {
      const result = await request({ url: '/notifications/unread-count', silent: true });
      this.setData({ unread: result.unread || 0 });
    } catch (error) {
      // 忽略
    }
  },

  onGoAddress() {
    wx.navigateTo({ url: '/pages/address/list' });
  },

  onGoStaff() {
    wx.navigateTo({ url: '/pages/staff/task' });
  },

  onGoMessage() {
    wx.navigateTo({ url: '/pages/message/list' });
  },

  onContact() {
    wx.showModal({
      title: '联系客服',
      content: '客服电话将在正式运营后开放，当前为开发阶段。',
      showCancel: false,
    });
  },

  onAbout() {
    wx.showModal({
      title: '关于',
      content: '家政清洁服务小程序 · 开发版本 v0.1.0\n已完成：服务浏览、规格选择、地址管理、时段查询、价格计算。',
      showCancel: false,
    });
  },
});
