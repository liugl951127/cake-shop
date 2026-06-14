// common/token.js - 登录态 token 管理
const crypto = require('crypto');

// 生产环境从环境变量读取,默认 demo key
const SECRET = process.env.TOKEN_SECRET || 'cake-shop-demo-secret-key-change-me';

function generateToken(payload) {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const data = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// token 内存缓存(单实例);多实例可换 Redis
const cache = new Map();
function cacheToken(token, info, ttl = 7 * 24 * 60 * 60 * 1000) {
  cache.set(token, { info, exp: Date.now() + ttl });
  // 定期清理
  if (cache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (v.exp < now) cache.delete(k);
    }
  }
}
function getCachedToken(token) {
  const c = cache.get(token);
  if (!c) return null;
  if (c.exp < Date.now()) { cache.delete(token); return null; }
  return c.info;
}
function revokeToken(token) { cache.delete(token); }

module.exports = { generateToken, verifyToken, cacheToken, getCachedToken, revokeToken };
