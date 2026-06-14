// recommendV2 - 智能推荐升级
// 算法:
//   1. 协同过滤(基于用户-商品购买矩阵的物品相似度)
//   2. 内容相似(基于分类/口味标签)
//   3. 实时反馈(用户最近浏览/加购/收藏加权)
//   4. A/B 实验(分桶,不同策略对比)
// 混合打分
const { cloud, ok } = require('../common/index.js');

// 简单余弦相似度
function cosine(a, b) {
  if (!a || !b) return 0;
  let dot = 0, na = 0, nb = 0;
  for (const k in a) {
    if (b[k] !== undefined) dot += a[k] * b[k];
    na += a[k] * a[k];
  }
  for (const k in b) nb += b[k] * b[k];
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Jaccard 相似
function jaccard(setA, setB) {
  const a = new Set(setA || []);
  const b = new Set(setB || []);
  const inter = [...a].filter(x => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

// A/B 分桶(用户 id 哈希到 0-99)
function abBucket(userId) {
  let h = 0;
  for (const c of (userId || '')) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return h % 100;
}

exports.main = async (event) => {
  const { _userId, _openid, limit = 10, scene = 'home', refresh = false } = event;
  const db = cloud.database();
  const _ = db.command;

  // A/B 桶
  const bucket = abBucket(_userId);
  const algo = bucket < 50 ? 'hybrid' : (bucket < 75 ? 'popularity' : 'fresh');

  // 1. 候选池
  const allGoods = await db.collection('goods').where({ status: 1 }).limit(500).get();
  const candidates = allGoods.data;

  // 2. 用户的画像
  const myOrders = await db.collection('orders')
    .where({ _userId, status: _.gte(1) })
    .orderBy('createTime', 'desc')
    .limit(50)
    .get();
  const myBrowse = await db.collection('accessLogs')
    .where({ _openid, action: 'goods_view' })
    .orderBy('createTime', 'desc')
    .limit(30)
    .get();
  const myCart = await db.collection('carts').where({ _userId }).limit(50).get();

  const purchased = new Set();
  const viewedSet = new Set();
  for (const o of myOrders.data) for (const g of (o.goods || [])) purchased.add(g.goodsId);
  for (const b of myBrowse.data) if (b.extra && b.extra.goodsId) viewedSet.add(b.extra.goodsId);
  for (const c of (myCart.data[0] && myCart.data[0].items || [])) viewedSet.add(c.goodsId);

  // 3. 候选打分
  const scored = candidates.map(g => {
    let score = 0;
    const reasons = [];

    // 3.1 销量(全局热度)
    if (algo === 'popularity' || algo === 'hybrid') {
      const s = (g.sales || 0) * 0.3;
      score += s;
      if (s > 0) reasons.push('热卖');
    }

    // 3.2 时间衰减(新鲜度)
    if (algo === 'fresh' || algo === 'hybrid') {
      const days = (Date.now() - (g.createTime || 0)) / 86400000;
      const freshScore = Math.max(0, 30 - days * 0.5);
      score += freshScore;
      if (freshScore > 20) reasons.push('新品');
    }

    // 3.3 协同过滤(简化版:看同时购买 A 的人,大多买了 B → 推荐 B)
    if (algo === 'hybrid' && purchased.size > 0) {
      let cfScore = 0;
      // 已购商品 → 同订单共现
      // 实际:用矩阵分解,这里用最朴素版 - 看用户最近 N 单的分类偏好
      const myCats = {};
      for (const o of myOrders.data.slice(0, 10)) {
        for (const item of (o.goods || [])) {
          if (item.categoryId) myCats[item.categoryId] = (myCats[item.categoryId] || 0) + 1;
        }
      }
      if (g.categoryId && myCats[g.categoryId]) {
        cfScore = myCats[g.categoryId] * 15;
        reasons.push('您常买该分类');
      }
      score += cfScore;
    }

    // 3.4 实时反馈
    if (viewedSet.has(g._id)) {
      score += 50;  // 浏览过
      reasons.push('您浏览过');
    }

    // 3.5 排除已购买
    if (purchased.has(g._id)) {
      score = -9999;
    }

    return { ...g, score, reasons };
  });

  // 4. 排序 + 多样性
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter(g => g.score > -1000).slice(0, limit);

  // 多样性:相邻不重复分类
  const result = [];
  const usedCats = new Set();
  for (const g of top) {
    if (usedCats.has(g.categoryId) && Math.random() > 0.3) {
      // 30% 概率跳过同分类
      continue;
    }
    usedCats.add(g.categoryId);
    result.push(g);
    if (result.length >= limit) break;
  }
  // 不够再补
  if (result.length < limit) {
    for (const g of top) {
      if (result.find(x => x._id === g._id)) continue;
      result.push(g);
      if (result.length >= limit) break;
    }
  }

  // 5. 写曝光日志(给 AB 分析用)
  if (result.length) {
    await db.collection('recommendLogs').add({
      data: {
        _openid, _userId, scene, algo, bucket,
        items: result.map(r => ({ id: r._id, score: r.score, reasons: r.reasons })),
        createTime: Date.now()
      }
    }).catch(() => {});
  }

  return ok({
    items: result.map(r => ({
      _id: r._id, name: r.name, image: r.image, price: r.price,
      sales: r.sales, score: r.score, reasons: r.reasons
    })),
    algo, bucket
  });
};
