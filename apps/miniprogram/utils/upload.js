const { BASE_URL } = require('../config/index');
const { getToken, getStaffToken } = require('./storage');

// 相对路径转绝对地址（后端返回的是 /uploads/xxx）
function toAbsoluteUrl(url) {
  if (!url) {
    return '';
  }
  if (url.indexOf('http') === 0) {
    return url;
  }
  return BASE_URL.replace(/\/api\/v1$/, '') + url;
}

// 上传单个文件，返回 { url, size }
function uploadFile(filePath, options) {
  const role = (options && options.role) || 'user';
  const token = role === 'staff' ? getStaffToken() : getToken();

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${BASE_URL}/uploads`,
      filePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success(res) {
        let body = {};
        try {
          body = JSON.parse(res.data);
        } catch (error) {
          reject(new Error('上传返回格式异常'));
          return;
        }

        if (body.code === 0) {
          resolve(body.data);
          return;
        }

        reject(Object.assign(new Error(body.message || '上传失败'), { code: body.code }));
      },
      fail() {
        reject(new Error('上传失败，请检查网络'));
      },
    });
  });
}

// 拍照（开发环境同时允许从相册选择，便于在开发者工具中调试）
function takePhoto() {
  return takePhotos(1).then((paths) => paths[0]);
}

// 拍摄/选择多张照片（最多 count 张）
function takePhotos(count) {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: count || 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      camera: 'back',
      success(res) {
        const files = res.tempFiles || [];
        if (files.length > 0) {
          resolve(files.map((file) => file.tempFilePath));
        } else {
          reject(new Error('未获取到照片'));
        }
      },
      fail(error) {
        reject(error);
      },
    });
  });
}

// 顺序上传多张照片，返回地址数组
async function uploadFiles(filePaths, options) {
  const urls = [];

  for (const filePath of filePaths) {
    const result = await uploadFile(filePath, options);
    urls.push(result.url);
  }

  return urls;
}

module.exports = { uploadFile, uploadFiles, takePhoto, takePhotos, toAbsoluteUrl };
