// smartReply - 智能客服回复
// 策略:
// 1. 关键词精确匹配(高优先级)
// 2. 关键词模糊匹配(包含任意一个)
// 3. 相似度匹配(简易 jaccard 系数)
// 4. 兜底:转人工
const { cloud, ok, auth } = require('../common/index.js');

// 关键词 -> 答案
const RULES = [
  { keys: ['发货', '发货时间', '什么时候发', '多久到'], answer: '同城订单 1-2 小时内发货,跨城 24-48 小时。\n\n新鲜蛋糕现做现发,下单后请耐心等待哦~ 🍰' },
  { keys: ['配送', '运费', '邮费'], answer: '满 99 元包邮\n\n不满 99 元收取运费 8 元\n\n到店自提免运费 🏪' },
  { keys: ['退款', '退货', '退钱', '怎么退'], answer: '退款流程:\n1. 订单详情页点击"申请退款"\n2. 填写退款原因\n3. 商家 1-3 个工作日内处理\n4. 款项原路退回 💰' },
  { keys: ['优惠券', '券', '怎么领'], answer: '领券中心有多种优惠券:\n- 满减券:满 100 减 10 等\n- 折扣券:9 折等\n- 新人券:50 元礼包\n\n进入"我的-优惠券"查看 🎟️' },
  { keys: ['会员', '积分', '等级', '签到'], answer: '会员等级:\n🥈 银卡:98 折 (成长值 100+)\n🥇 金卡:95 折 (成长值 500+)\n💎 钻石:9 折 (成长值 2000+)\n\n每日签到 +5 积分,消费 1 元 = 1 积分 👑' },
  { keys: ['拼团', '团购', '开团'], answer: '拼团玩法:\n- 2-3 人成团享团购价\n- 团长免单,团员享低价\n- 24 小时未成团自动退款 👥' },
  { keys: ['秒杀', '限时'], answer: '每日 10:00 上新秒杀,限量特价,先到先得! ⚡' },
  { keys: ['自提', '门店', '到店'], answer: '支持到店自提,选择自提后:\n- 免运费\n- 可到指定门店取货\n- 取货时间:9:00-22:00\n\n支持查看附近门店 🏪' },
  { keys: ['修改地址', '改地址', '地址错了'], answer: '订单发货前可在订单详情页修改收货地址,发货后请及时联系客服修改哦~' },
  { keys: ['发票', '开票'], answer: '支持开具电子发票,下单时备注开票信息(抬头 + 税号),3 个工作日内发送至邮箱 📧' },
  { keys: ['营业时间', '几点', '上班'], answer: '客服在线时间:9:00-21:00\n门店营业时间:9:00-22:00 ⏰' },
  { keys: ['人工', '转人工', '客服', '真人'], answer: '正在为您接入人工客服,请稍等...' }
];

function jaccard(a, b) {
  const sa = new Set(a.split(''));
  const sb = new Set(b.split(''));
  const inter = [...sa].filter(c => sb.has(c)).length;
  const union = new Set([...sa, ...sb]).size;
  return inter / union;
}

function matchRule(text) {
  // 1. 精确包含
  for (const rule of RULES) {
    for (const k of rule.keys) {
      if (text.includes(k)) return rule;
    }
  }
  // 2. 相似度
  let best = null;
  let bestScore = 0.15;  // 阈值
  for (const rule of RULES) {
    for (const k of rule.keys) {
      if (k.length < 2) continue;
      const score = jaccard(text.toLowerCase(), k.toLowerCase());
      if (score > bestScore) {
        bestScore = score;
        best = rule;
      }
    }
  }
  return best;
}

exports.main = auth(async (event) => {
  const { text, sessionId = '' } = event;
  if (!text) return ok(null);

  const rule = matchRule(text);

  // 如果匹配"人工"或没有匹配,标记需要转人工
  const isArtificial = !rule || (rule.keys.includes('人工') || rule.keys.includes('转人工'));

  if (isArtificial) return ok({ match: false, needHuman: true });

  // 命中规则
  // 可选:把问答写入会话(让用户看到 AI 回复 + 提示转人工)
  if (sessionId) {
    const session = await cloud.database().collection('chatSessions').where({ sessionId }).limit(1).get();
    if (session.data[0]) {
      const s = session.data[0];
      await cloud.database().collection('chatMessages').add({
        data: {
          messageId: `M${Date.now()}${Math.floor(Math.random() * 1000)}`,
          sessionId,
          _openid: s._openid,
          fromType: 'system', fromName: '智能客服',
          type: 'text',
          content: rule.answer + '\n\n💡 没解决?输入"人工"转接真人客服',
          status: 1,
          createTime: Date.now()
        }
      });
      // 标记 AI 命中,降低人工介入
      await cloud.database().collection('chatSessions').doc(s._id).update({
        data: { aiMatched: true, updateTime: Date.now() }
      });
    }
  }

  return ok({ match: true, answer: rule.answer, needHuman: false });
});
