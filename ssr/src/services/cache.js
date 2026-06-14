// src/services/cache.js - 缓存(Redis 优先,降级 LRU)
const Redis = require('ioredis');
const LRUCache = require('lru-cache');

let useRedis = false;
let redis = null;
let lru = null;

const DEFAULT_TTL = 5 * 60;  // 5 分钟

function initCache() {
  if (process.env.REDIS_URL) {
    try {
      redis = new Redis(process.env.REDIS_URL);
      redis.on('error', (e) => {
        console.warn('Redis 错误,降级 LRU:', e.message);
        useRedis = false;
      });
      redis.on('connect', () => {
        useRedis = true;
        console.log('✅ Redis 连接成功');
      });
    } catch (e) {
      console.warn('Redis 初始化失败,降级 LRU');
    }
  }
  lru = new LRUCache({ max: 500, ttl: DEFAULT_TTL * 1000 });
}

async function get(key) {
  if (useRedis) {
    try {
      const v = await redis.get(key);
      return v ? JSON.parse(v) : null;
    } catch (e) {}
  }
  return lru.get(key) || null;
}

async function set(key, value, ttl = DEFAULT_TTL) {
  if (useRedis) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttl);
      return;
    } catch (e) {}
  }
  lru.set(key, value, { ttl: ttl * 1000 });
}

async function del(key) {
  if (useRedis) {
    try { await redis.del(key); return; } catch (e) {}
  }
  lru.delete(key);
}

async function clear() {
  if (useRedis) {
    try { await redis.flushdb(); return; } catch (e) {}
  }
  lru.clear();
}

module.exports = { initCache, get, set, del, clear };
