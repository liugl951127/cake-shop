// getPhone - 解密手机号(用 button open-type="getPhoneNumber" 拿到的)
const { cloud, ok, fail, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { encryptedData, iv } = event;
  if (!encryptedData || !iv) return fail('参数缺失');

  const wxContext = cloud.getWXContext();
  const db = cloud.database();

  try {
    // 调微信开放接口解密手机号
    const res = await cloud.openapi.phonenumber.getPhoneNumber({
      code: event.code // 客户端拿到的动态 code
    }).catch(() => null);

    if (!res) {
      // 旧版走 encryptedData 解密(需 session_key)
      return fail('需要新版的手机号快速验证组件');
    }

    const phone = res.phoneInfo ? res.phoneInfo.phoneNumber : '';
    if (!phone) return fail('解析手机号失败');

    // 更新用户手机号
    await db.collection('users').doc(event._userId).update({
      data: { phone, updateTime: Date.now() }
    });

    return ok({ phone });
  } catch (e) {
    return fail('获取手机号失败: ' + e.message);
  }
});
