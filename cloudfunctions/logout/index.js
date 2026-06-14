// logout - 退出登录,吊销 token
const { ok, revokeToken } = require('../common/index.js');

exports.main = async (event) => {
  if (event.token) revokeToken(event.token);
  return ok();
};
