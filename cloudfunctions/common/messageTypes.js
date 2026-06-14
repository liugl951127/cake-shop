// common/messageTypes.js
// 统一消息/事件类型定义(云函数 + 客户端 + Spring Boot 后台共用)
//
// 聊天消息: text / image / rich / file / video / audio / voice / location / map
// 行为事件: page_view / click / stay / form / submit / search / share / pay / cart / fav
// 实时事件: ws_open / ws_msg / ws_ack / ws_close

const MessageType = {
  // ===== 聊天消息 =====
  TEXT: 'text',                     // 纯文本
  IMAGE: 'image',                   // 单张图
  RICH: 'rich',                     // 富文本(包含文字+图片+链接)
  FILE: 'file',                     // 任意文件(需文件权限)
  VIDEO: 'video',                   // 视频(需相册权限)
  AUDIO: 'audio',                   // 音频
  VOICE: 'voice',                   // 语音消息(需麦克风)
  LOCATION: 'location',             // 位置(需位置权限)
  MAP: 'map',                       // 地图
  PRODUCT_CARD: 'product_card',     // 商品卡片
  ORDER_CARD: 'order_card',         // 订单卡片
  SYSTEM: 'system',                 // 系统消息
  TYPING: 'typing',                 // 正在输入
  READ_RECEIPT: 'read_receipt',     // 已读回执

  // ===== 行为事件 =====
  PAGE_VIEW: 'page_view',           // 浏览页面
  ELEMENT_CLICK: 'element_click',   // 点击元素
  ELEMENT_EXPOSE: 'element_expose', // 元素曝光
  PAGE_STAY: 'page_stay',           // 页面停留/离开
  FORM_INPUT: 'form_input',         // 表单输入
  FORM_SUBMIT: 'form_submit',       // 表单提交
  SEARCH: 'search',                 // 搜索
  SHARE: 'share',                   // 分享
  ADD_CART: 'add_cart',             // 加购物车
  FAVOR: 'favor',                   // 收藏
  PAY_START: 'pay_start',           // 发起支付
  PAY_SUCCESS: 'pay_success',       // 支付成功
  LOGIN: 'login',                   // 登录
  LOGOUT: 'logout',                 // 登出

  // ===== 实时事件 =====
  WS_OPEN: 'ws_open',               // WS 连接建立
  WS_PING: 'ws_ping',               // 心跳
  WS_PONG: 'ws_pong',               // 心跳响应
  WS_MSG: 'ws_msg',                 // WS 消息
  WS_ACK: 'ws_ack',                 // 消息确认
  WS_CLOSE: 'ws_close'              // 连接关闭
};

const MessageTypeSet = new Set(Object.values(MessageType));

// ===== 富文本节点 =====
const RichNodeType = {
  TEXT: 'text',                     // 纯文字
  BOLD: 'b',                        // 加粗
  ITALIC: 'i',                      // 斜体
  UNDERLINE: 'u',                   // 下划线
  STRIKE: 's',                      // 删除线
  LINK: 'a',                        // 链接
  IMG: 'img',                       // 图片(需相册权限)
  EMOJI: 'emoji',                   // 表情
  BR: 'br',                         // 换行
  CODE: 'code',                     // 行内代码
  BLOCKQUOTE: 'blockquote',         // 引用
  LOCATION: 'location',             // 位置(需位置权限)
  MAP: 'map',                       // 地图(需位置权限)
  VIDEO: 'video',                   // 视频(需相册)
  AUDIO: 'audio',                   // 音频
  VOICE: 'voice',                   // 语音
  FILE: 'file',                     // 文件(需文件权限)
  ORDER_CARD: 'order_card',         // 订单卡(嵌套)
  PRODUCT_CARD: 'product_card',     // 商品卡(嵌套)
  AT: 'at'                          // @ 某人
};

// ===== 富文本协议 =====
/**
 * 富文本节点(完整):
 *   { t:'text', v:'文字' }
 *   { t:'b'|'i'|'u'|'s', v:'文字' }        格式
 *   { t:'a', v:'链接文字', a:{href, target} }
 *   { t:'img', v:'cloud://....', a:{w,h,thumb} }     需 scope.readPhotos
 *   { t:'video', v:'cloud://....', a:{w,h,duration,thumb} }  需 scope.album
 *   { t:'audio'|'voice', v:'cloud://....', a:{duration} }  需 scope.microphone
 *   { t:'file', v:'cloud://....', a:{name, size, mime} }  需 scope.file
 *   { t:'location', v:'lat,lng', a:{name, address, accuracy, scale} }  需 scope.userLocation
 *   { t:'map', v: JSON.stringify({lat,lng,name}) }    地图缩略
 *   { t:'emoji', v:'😀' }
 *   { t:'br' }                                   换行
 *   { t:'order_card'|'product_card', v:'id', a:{...} }
 *   { t:'at', v:'userId' }
 */
function isValidRich(nodes) {
  if (!Array.isArray(nodes)) return false;
  if (nodes.length === 0) return false;
  if (nodes.length > 200) return false;
  for (const n of nodes) {
    if (!n || typeof n !== 'object') return false;
    if (!RichNodeType[n.t]) return false;
    if (n.t === RichNodeType.IMG || n.t === RichNodeType.VIDEO
        || n.t === RichNodeType.AUDIO || n.t === RichNodeType.VOICE
        || n.t === RichNodeType.FILE) {
      if (typeof n.v !== 'string' || n.v.length < 4) return false;
    } else if (n.t === RichNodeType.LINK) {
      if (typeof n.v !== 'string' || !n.a || typeof n.a.href !== 'string') return false;
      if (n.a.href.length > 2000) return false;
    } else if (n.t === RichNodeType.LOCATION) {
      // v: 字符串 "lat,lng" 或对象 {latitude, longitude}
      if (n.v == null) return false;
      if (typeof n.v === 'string' && n.v.length > 200) return false;
      if (typeof n.v === 'object' && n.v.latitude == null) return false;
    } else if (n.t === RichNodeType.MAP) {
      if (n.v == null) return false;
    } else if (n.t !== RichNodeType.BR) {
      if (typeof n.v !== 'string') return false;
      if (n.v.length > 5000) return false;
    }
  }
  return true;
}

// 把富文本转纯文本(用于搜索/预览)
function richToPlain(nodes) {
  if (!Array.isArray(nodes)) return '';
  let out = '';
  for (const n of nodes) {
    if (n.t === 'br') { out += '\n'; continue; }
    if (n.t === 'img' || n.t === 'emoji') { out += '[图片]'; continue; }
    if (n.t === 'video') { out += '[视频]'; continue; }
    if (n.t === 'audio' || n.t === 'voice') { out += '[语音]'; continue; }
    if (n.t === 'file') { out += '[文件]'; continue; }
    if (n.t === 'location' || n.t === 'map') { out += '[位置]'; continue; }
    out += n.v || '';
  }
  return out;
}

// 文本字数(用于"过长"判断)
function richTextLength(nodes) {
  if (!Array.isArray(nodes)) return 0;
  let total = 0;
  for (const n of nodes) {
    if (['img','emoji','video','audio','voice','file','location','map']
        .includes(n.t)) total += 1;
    else if (n.t !== 'br') total += (n.v || '').length;
  }
  return total;
}

// 提取富文本中所有"需授权"节点(用于前端提前 ask 权限)
function getRequiredScopes(nodes) {
  if (!Array.isArray(nodes)) return [];
  const set = new Set();
  for (const n of nodes) {
    if (!n || !n.t) continue;
    if (n.t === 'img') set.add('readPhotosAlbum');
    else if (n.t === 'video') set.add('album');
    else if (n.t === 'location' || n.t === 'map') set.add('userLocation');
    else if (n.t === 'voice' || n.t === 'audio') set.add('microphone');
    else if (n.t === 'file') set.add('file');
  }
  return Array.from(set);
}

// ===== 行为日志规范 =====
const BehaviorScene = {
  MINIPROGRAM: 'miniprogram',
  H5: 'h5',
  ADMIN: 'admin'
};

module.exports = {
  MessageType,
  MessageTypeSet,
  RichNodeType,
  BehaviorScene,
  isValidRich,
  richToPlain,
  richTextLength,
  getRequiredScopes
};
