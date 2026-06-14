// common/cache.js - 内存缓存
// 简易 LRU 风格(避免无界增长)
// 用法:
//   const { cache } = require('../common/cache.js');
//   cache.set('user:1', { name: 'x' }, 60);
//   cache.get('user:1');
//   cache.del('user:1');

const { config } = require('./config.js');

class TTLCache {
  constructor(maxSize = 5000) {
    this.map = new Map();   // key -> { value, expire }
    this.maxSize = maxSize;
  }

  // 读
  get(key) {
    const item = this.map.get(key);
    if (!item) return null;
    if (item.expire && item.expire < Date.now()) {
      this.map.delete(key);
      return null;
    }
    // 命中提到头部(LRU)
    this.map.delete(key);
    this.map.set(key, item);
    return item.value;
  }

  // 写
  set(key, value, ttlSeconds) {
    if (this.map.size >= this.maxSize && !this.map.has(key)) {
      // 淘汰最早的
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }
    this.map.set(key, {
      value,
      expire: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0
    });
  }

  del(key) { this.map.delete(key); }
  has(key) { return this.get(key) !== null; }
  clear() { this.map.clear(); }
  size() { return this.map.size; }

  // 取或计算
  async getOrSet(key, ttlSeconds, loader) {
    const v = this.get(key);
    if (v !== null) return v;
    const value = await loader();
    this.set(key, value, ttlSeconds);
    return value;
  }
}

const cache = new TTLCache();

module.exports = { cache, TTLCache };
