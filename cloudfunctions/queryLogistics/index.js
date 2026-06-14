// queryLogistics - 物流查询(快递100/快递鸟 适配)
// 真实环境:需配置环境变量 LOGISTICS_KEY,LOGISTICS_CUSTOMER
const { cloud, ok, fail } = require('../common/index.js');
const https = require('https');
const crypto = require('crypto');

const KEY = process.env.LOGISTICS_KEY || '';
const CUSTOMER = process.env.LOGISTICS_CUSTOMER || '';
const USE_MOCK = !KEY;

/**
 * 快递鸟方案
 * 入参: { company: '顺丰', number: 'SF1234567890', phone: '13800138000' (顺丰必填) }
 */
async function queryKuaidi100(company, number) {
  return new Promise((resolve) => {
    const param = JSON.stringify({ com: company, num: number });
    const sign = crypto.createHash('md5').update(param + KEY + CUSTOMER).digest('hex');
    const postData = `customer=${CUSTOMER}&sign=${sign}&param=${encodeURIComponent(param)}`;
    const req = https.request({
      hostname: 'poll.kuaidi100.com',
      port: 443,
      path: '/poll/query.do',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ message: 'parse_error' }); }
      });
    });
    req.on('error', () => resolve({ message: 'network_error' }));
    req.write(postData);
    req.end();
  });
}

// 演示数据生成
function mockTrace(company, number) {
  const now = Date.now();
  const traces = [
    { time: now - 1000 * 60 * 60 * 2, context: '【' + (company || '快递') + '】已揽收' },
    { time: now - 1000 * 60 * 90, context: '快件已到达 【广州转运中心】' },
    { time: now - 1000 * 60 * 60, context: '快件已离开 【广州转运中心】,下一站 【北京转运中心】' },
    { time: now - 1000 * 60 * 30, context: '快件已到达 【北京转运中心】' },
    { time: now - 1000 * 60 * 10, context: '【北京海淀】派件中,快递员: 张师傅 13800138000' }
  ];
  return { message: 'ok', state: '3', data: traces.reverse() };
}

exports.main = async (event) => {
  const { company, number, phone = '' } = event;
  if (!company || !number) return fail('物流公司与单号必填');

  let result;
  if (USE_MOCK) {
    result = mockTrace(company, number);
  } else {
    result = await queryKuaidi100(company, number);
  }
  return ok(result);
};
