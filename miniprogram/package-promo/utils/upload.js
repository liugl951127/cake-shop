// upload.js - 上传到云存储
function uploadImage(filePath, dir = 'uploads/') {
  return new Promise((resolve, reject) => {
    const ext = filePath.match(/\.[^.]+?$/);
    const cloudPath = dir + Date.now() + '_' + Math.random().toString(36).substr(2, 8) + (ext ? ext[0] : '.jpg');
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (res) => resolve(res.fileID),
      fail: reject
    });
  });
}

module.exports = { uploadImage };
