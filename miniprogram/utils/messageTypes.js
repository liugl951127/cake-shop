// miniprogram/utils/messageTypes.js
// 客户端版本(简化) - 与 cloudfunctions/common/messageTypes.js 对齐
// 服务端会校验 type 是否在 MessageTypeSet 中

const MessageType = {
  // 聊天
  TEXT: 'text',
  IMAGE: 'image',
  RICH: 'rich',
  FILE: 'file',
  PRODUCT_CARD: 'product_card',
  ORDER_CARD: 'order_card',
  SYSTEM: 'system',
  TYPING: 'typing',
  READ_RECEIPT: 'read_receipt',
  // 行为
  PAGE_VIEW: 'page_view',
  ELEMENT_CLICK: 'element_click',
  ELEMENT_EXPOSE: 'element_expose',
  PAGE_STAY: 'page_stay',
  FORM_INPUT: 'form_input',
  FORM_SUBMIT: 'form_submit',
  SEARCH: 'search',
  SHARE: 'share',
  ADD_CART: 'add_cart',
  FAVOR: 'favor',
  PAY_START: 'pay_start',
  PAY_SUCCESS: 'pay_success',
  LOGIN: 'login',
  LOGOUT: 'logout',
  // 实时
  WS_OPEN: 'ws_open',
  WS_PING: 'ws_ping',
  WS_PONG: 'ws_pong',
  WS_MSG: 'ws_msg',
  WS_ACK: 'ws_ack',
  WS_CLOSE: 'ws_close'
};

const RichNodeType = {
  TEXT: 'text',
  BOLD: 'b',
  ITALIC: 'i',
  UNDERLINE: 'u',
  STRIKE: 's',
  LINK: 'a',
  IMG: 'img',
  EMOJI: 'emoji',
  BR: 'br',
  CODE: 'code',
  BLOCKQUOTE: 'blockquote',
  ORDER_CARD: 'order_card',
  PRODUCT_CARD: 'product_card',
  AT: 'at'
};

module.exports = { MessageType, RichNodeType };
