// aiChat - LLM 智能客服(支持上下文)
// 配置环境变量: LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
// 不配置时走降级 - 提示转人工
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const https = require('https');

const SYSTEM_PROMPT = `你是甜心蛋糕小程序的智能客服助手"甜心"。
职责: 回答用户关于蛋糕、订单、配送、优惠券、会员等问题。
风格: 亲切、温暖、可爱(用 🍰🎂 等 emoji),回复简短(50-150 字)。

蛋糕店信息:
- 商品:生日蛋糕、面包、饼干、定制蛋糕
- 配送:同城 1-2 小时,跨城 24-48 小时
- 运费:满 99 包邮,否则 8 元,自提免运费
- 会员:4 等级(普通/银98折/金95折/钻9折),消费 1 元 = 1 积分
- 优惠券:满减券、折扣券、新人券、运费券
- 拼团:2-3 人成团享团购价,24 小时未成团退款
- 秒杀:每日限时特价
- 退换:非质量问题不退换,质量问题 1-3 工作日处理
- 营业:9:00-22:00

如果用户要求转人工、投诉、紧急问题,统一回复:
"好的,马上为您接入人工客服,请稍等 ⏳"
并以特殊字符串 [HUMAN] 开头,前端检测到会自动转接。`;

exports.main = async (event, context) => {
  const { text, sessionId = '', history = [] } = event;
  if (!text) return { code: -1, msg: 'text 必填' };

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    // 降级: 没配 LLM key
    return {
      code: 0,
      data: {
        answer: 'AI 客服暂未启用,为您接入人工客服,请稍等 ⏳\n\n[HUMAN]',
        isHuman: true
      }
    };
  }

  const baseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com';
  const model = process.env.LLM_MODEL || 'gpt-3.5-turbo';

  // 构造消息(系统 + 历史 + 当前)
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-10).map(m => ({ role: m.fromType === 'user' ? 'user' : 'assistant', content: m.content })),
    { role: 'user', content: text }
  ];

  try {
    const answer = await callLLM(apiKey, baseUrl, model, messages);
    const isHuman = answer.startsWith('[HUMAN]');
    return {
      code: 0,
      data: {
        answer: answer.replace(/^\[HUMAN\]\s*/, ''),
        isHuman
      }
    };
  } catch (e) {
    console.error('AI 失败:', e);
    return {
      code: 0,
      data: {
        answer: '抱歉,智能客服暂时有点迷糊,为您接入人工客服,请稍等 ⏳\n\n[HUMAN]',
        isHuman: true
      }
    };
  }
};

function callLLM(apiKey, baseUrl, model, messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 500 });
    const url = new URL('/v1/chat/completions', baseUrl);
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
          resolve(json.choices[0].message.content);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}
