// common/token.js - 登录态 token 管理
const crypto = require('crypto');
const { config } = require('./config.js');
const { cache } = require('./cache.js');

const SECRET = config.TOKEN_SECRET;

/**
 * 生成 token(HMAC-SHA256 签名)
 * payload: { _id, openid, ... }
 * 过期: 默认 7 天(从 config.TOKEN_TTL)
 */
function generateToken(payload) {
  const exp = Date.now() + config.TOKEN_TTL;
  const data = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  // 严格相等(防时序攻击)
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function cacheToken(token, info, ttl) {
  cache.set(`token:${token}`, info, (ttl || config.TOKEN_TTL) / 1000);
}
function getCachedToken(token) {
  return cache.get(`token:${token}`);
}
function revokeToken(token) {
  cache.del(`token:${token}`);
}

module.exports = { generateToken, verifyToken, cacheToken, getCachedToken, revokeToken };
