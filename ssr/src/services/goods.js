// src/services/goods.js - 商品数据(缓存 + 云开发,降级静态)
const cache = require('./cache');
const cloud = require('./cloud');
const fallback = require('./fallback');

const TTL_HOME = 60;       // 首页 1 分钟
const TTL_DETAIL = 300;    // 详情 5 分钟
const TTL_LIST = 60;       // 列表 1 分钟

async function getHomeData() {
  const key = 'home:data';
  let data = await cache.get(key);
  if (data) return data;

  try {
    // 调云函数拿实时数据
    const banners = await cloud.callFunction('getCmsBanners');
    const cats = await cloud.callFunction('getCategories');
    const goods = await cloud.callFunction('getGoods', { recommend: true, pageSize: 10 });
    data = { banners, categories: cats, recommend: goods };
  } catch (e) {
    console.warn('云函数失败,用降级数据:', e.message);
    data = {
      banners: fallback.homeBanners,
      categories: fallback.categories,
      recommend: fallback.hotGoods
    };
  }
  await cache.set(key, data, TTL_HOME);
  return data;
}

async function getGoodsDetail(id) {
  const key = `goods:${id}`;
  let data = await cache.get(key);
  if (data) return data;

  try {
    data = await cloud.callFunction('getGoodsDetail', { id });
  } catch (e) {
    data = fallback.goods(id);
  }
  await cache.set(key, data, TTL_DETAIL);
  return data;
}

async function getGoodsList(category = '', keyword = '', page = 1) {
  const key = `goods:list:${category}:${keyword}:${page}`;
  let data = await cache.get(key);
  if (data) return data;

  try {
    data = await cloud.callFunction('getGoods', { category, keyword, page, pageSize: 20 });
  } catch (e) {
    data = fallback.hotGoods;
  }
  await cache.set(key, data, TTL_LIST);
  return data;
}

async function getCategories() {
  const key = 'categories:all';
  let data = await cache.get(key);
  if (data) return data;
  try {
    data = await cloud.callFunction('getCategories');
  } catch (e) {
    data = fallback.categories;
  }
  await cache.set(key, data, TTL_LIST);
  return data;
}

module.exports = { getHomeData, getGoodsDetail, getGoodsList, getCategories };
