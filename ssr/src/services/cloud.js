// src/services/cloud.js - 调微信云开发
const axios = require('axios');

let ACCESS_TOKEN = '';
let TOKEN_EXPIRE = 0;

const CLOUD_BASE = process.env.CLOUD_BASE_URL || '';
const APPID = process.env.WX_APPID;
const SECRET = process.env.WX_SECRET;

async function getAccessToken() {
  if (ACCESS_TOKEN && Date.now() < TOKEN_EXPIRE - 300000) return ACCESS_TOKEN;
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${SECRET}`;
  const { data } = await axios.get(url);
  if (data.access_token) {
    ACCESS_TOKEN = data.access_token;
    TOKEN_EXPIRE = Date.now() + (data.expires_in * 1000);
    return ACCESS_TOKEN;
  }
  throw new Error('获取 access_token 失败: ' + JSON.stringify(data));
}

// 调云函数(HTTP 触发器方式)
async function callFunction(name, data = {}) {
  if (!CLOUD_BASE) throw new Error('未配置 CLOUD_BASE_URL');
  const url = `${CLOUD_BASE}/functions/${name}`;
  const { data: res } = await axios.post(url, data, { timeout: 10000 });
  if (res.code !== 0) throw new Error(res.msg || '云函数调用失败');
  return res.data;
}

async function initCloud() {
  if (CLOUD_BASE) {
    console.log('☁️  云开发: 已配置');
  } else {
    console.warn('⚠️  未配置 CLOUD_BASE_URL,SSR 走降级(返回静态模板)');
  }
}

module.exports = { callFunction, getAccessToken, initCloud, getAccessToken: () => ACCESS_TOKEN };
