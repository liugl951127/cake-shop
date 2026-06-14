function formatTime(date, fmt = 'YYYY-MM-DD HH:mm:ss') {
  if (!(date instanceof Date)) date = new Date(date);
  const o = {
    'M+': date.getMonth() + 1,
    'D+': date.getDate(),
    'H+': date.getHours(),
    'm+': date.getMinutes(),
    's+': date.getSeconds()
  };
  let r = fmt;
  if (/(Y+)/.test(r)) r = r.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length));
  for (const k in o) {
    if (new RegExp(`(${k})`).test(r)) {
      r = r.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : (('00' + o[k]).substr(('' + o[k]).length)));
    }
  }
  return r;
}
module.exports = { formatTime };
