// searchGoods - 全文搜索 + 热词 + 搜索历史
const { cloud, ok } = require('../common/index.js');

exports.main = async (event) => {
  const { keyword = '', limit = 20, saveHistory = true, openid = '' } = event;
  const db = cloud.database();
  const _ = db.command;
  const results = { goods: [], hot: [], history: [], suggestions: [] };

  // 1. 热词(从搜索行为聚合,取最近 7 天 top 10)
  if (saveHistory) {
    const since = Date.now() - 7 * 86400000;
    const recent = await db.collection('behaviors')
      .where({ action: 'search', createTime: _.gt(since) })
      .limit(500)
      .get();
    const cnt = {};
    for (const r of recent.data) {
      const k = (r.keyword || '').trim();
      if (k) cnt[k] = (cnt[k] || 0) + 1;
    }
    results.hot = Object.entries(cnt)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));
  }

  // 2. 搜索历史(本地缓存,云端只存用户搜索过的)
  if (openid) {
    const hist = await db.collection('behaviors')
      .where({ _openid: openid, action: 'search' })
      .orderBy('createTime', 'desc')
      .limit(20)
      .get();
    // 去重(同一 keyword 只保留最近)
    const seen = new Set();
    results.history = [];
    for (const h of hist.data) {
      if (seen.has(h.keyword)) continue;
      seen.add(h.keyword);
      results.history.push(h.keyword);
      if (results.history.length >= 10) break;
    }
  }

  // 3. 商品搜索(模糊匹配 name + desc + tags)
  if (keyword) {
    const reg = db.RegExp({ regexp: keyword, options: 'i' });
    const res = await db.collection('goods')
      .where(db.command.or(
        { name: reg },
        { desc: reg },
        { tags: reg }
      ))
      .where({ status: 1 })
      .limit(limit)
      .get();
    results.goods = res.data;

    // 搜索建议(基于命中的标签/分类聚合)
    const tagSet = new Set();
    const catSet = new Set();
    for (const g of res.data) {
      for (const t of (g.tags || [])) tagSet.add(t);
      if (g.category) catSet.add(g.category);
    }
    results.suggestions = [...tagSet].slice(0, 5).map(t => ({ type: 'tag', value: t }));

    // 保存搜索行为
    if (saveHistory && openid) {
      await db.collection('behaviors').add({
        data: {
          _openid: openid, action: 'search', keyword,
          resultCount: results.goods.length,
          createTime: Date.now()
        }
      }).catch(() => {});
    }
  } else {
    // 没关键词,返回热门商品做兜底
    const fallback = await db.collection('goods')
      .where({ status: 1, recommend: true })
      .orderBy('sales', 'desc')
      .limit(10)
      .get();
    results.goods = fallback;
  }

  return ok(results);
};
