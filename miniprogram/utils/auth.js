// utils/auth.js - 鉴权 + 登录管理(完整版)
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'userInfo';

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || '';
}

function getUser() {
  return wx.getStorageSync(USER_KEY) || {};
}

function saveAuth(token, user) {
  wx.setStorageSync(TOKEN_KEY, token);
  wx.setStorageSync(USER_KEY, user);
  const app = getApp();
  if (app) {
    app.globalData.token = token;
    app.globalData.userInfo = user;
    app.globalData.openid = user.openid;
    app.globalData.isAdmin = !!user.isAdmin;
  }
}

function clearAuth() {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(USER_KEY);
  const app = getApp();
  if (app) {
    app.globalData.token = '';
    app.globalData.userInfo = null;
    app.globalData.openid = null;
    app.globalData.isAdmin = false;
  }
}

/**
 * 一键登录:wx.login 拿 code → 调云函数换 token + 用户信息
 */
function login(force = false, inviterCode = '') {
  return new Promise((resolve, reject) => {
    // 已有 token 且不强制刷新,直接返回
    if (!force && getToken()) {
      const u = getUser();
      if (u && u.openid) {
        // 如果有邀请码、且未绑定,尝试绑
        if (inviterCode && !u.inviterOpenid) {
          bindInviterRemote(inviterCode).catch(() => {});
        }
        return resolve(u);
      }
    }

    wx.login({
      success: async (loginRes) => {
        if (!loginRes.code) return reject(new Error('wx.login 失败'));
        try {
          const res = await wx.cloud.callFunction({
            name: 'login',
            data: { code: loginRes.code, inviterCode: inviterCode || '' }
          });
          if (res.result && res.result.code === 0) {
            const { token, ...user } = res.result.data;
            saveAuth(token, user);
            resolve(user);
          } else {
            reject(res.result);
          }
        } catch (e) {
          reject(e);
        }
      },
      fail: reject
    });
  });
}

function bindInviterRemote(code) {
  return wx.cloud.callFunction({
    name: 'bindInviter', data: { inviterCode: code }
  }).then((res) => res.result && res.result.data);
}

/**
 * 授权更新用户信息(头像/昵称)
 * 在 button open-type="chooseAvatar" 和 input type="nickname" 拿到后调用
 */
function updateProfile(nickName, avatarUrl) {
  return new Promise((resolve, reject) => {
    wx.login({
      success: async (loginRes) => {
        if (!loginRes.code) return reject(new Error('wx.login 失败'));
        try {
          const res = await wx.cloud.callFunction({
            name: 'login',
            data: { code: loginRes.code, nickName, avatarUrl }
          });
          if (res.result && res.result.code === 0) {
            const { token, ...user } = res.result.data;
            saveAuth(token, user);
            resolve(user);
          } else {
            reject(res.result);
          }
        } catch (e) {
          reject(e);
        }
      },
      fail: reject
    });
  });
}

/**
 * 获取手机号(新版组件 - 需 button open-type="getPhoneNumber")
 * 拿到 code 之后调云函数解析
 */
function getPhoneNumber(detail) {
  return new Promise((resolve, reject) => {
    if (!detail || !detail.code) return reject(new Error('用户拒绝授权'));
    wx.cloud.callFunction({
      name: 'getPhone',
      data: { code: detail.code }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        const user = getUser();
        user.phone = res.result.data.phone;
        wx.setStorageSync(USER_KEY, user);
        resolve(res.result.data.phone);
      } else {
        reject(res.result);
      }
    }).catch(reject);
  });
}

function logout() {
  const token = getToken();
  if (token) {
    wx.cloud.callFunction({ name: 'logout', data: { token } }).catch(() => {});
  }
  clearAuth();
}

// Apple 登录
function appleLogin(detail) {
  // detail 来自 <button open-type="apple" bind:getuserinfo="onApple">
  return new Promise((resolve, reject) => {
    if (!detail || !detail.detail) return reject(new Error('Apple 授权失败'));
    const d = detail.detail;
    if (!d.identityToken && !d.code) return reject(new Error('未拿到 Apple 凭证'));
    wx.cloud.callFunction({
      name: 'appleLogin',
      data: {
        identityToken: d.identityToken,
        code: d.code,
        userInfo: d.userInfo || {}
      }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        const { token, ...user } = res.result.data;
        saveAuth(token, user);
        resolve(user);
      } else {
        reject(res.result);
      }
    }).catch(reject);
  });
}

// 手机号: 发送验证码
function phoneSendCode(phone) {
  return wx.cloud.callFunction({
    name: 'phoneLogin',
    data: { action: 'sendCode', phone }
  }).then(res => {
    if (res.result && res.result.code === 0) return res.result.data;
    throw res.result;
  });
}

// 手机号: 登录
function phoneLogin(phone, code) {
  return wx.cloud.callFunction({
    name: 'phoneLogin',
    data: { action: 'login', phone, code }
  }).then(res => {
    if (res.result && res.result.code === 0) {
      const { token, ...user } = res.result.data;
      saveAuth(token, user);
      return user;
    }
    throw res.result;
  });
}

function checkLogin() {
  return !!(getToken() && getUser().openid);
}

function requireLogin() {
  if (!checkLogin()) {
    nav.to('/pages/login/login');
    return false;
  }
  return true;
}

module.exports = {
  login, updateProfile, getPhoneNumber, logout,
  checkLogin, requireLogin,
  getToken, getUser, saveAuth, clearAuth,
  appleLogin, phoneSendCode, phoneLogin
};
