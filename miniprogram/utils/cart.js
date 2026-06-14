// utils/cart.js - 本地购物车
const KEY = 'cart';

function get() {
  return wx.getStorageSync(KEY) || [];
}

function save(list) {
  wx.setStorageSync(KEY, list);
  getApp().refreshCartBadge();
}

function add(goods, count = 1) {
  const list = get();
  const idx = list.findIndex(i => i._id === goods._id);
  if (idx > -1) {
    list[idx].count += count;
  } else {
    list.push({
      _id: goods._id,
      name: goods.name,
      price: goods.price,
      image: goods.image,
      count,
      spec: goods.spec || ''
    });
  }
  save(list);
}

function update(_id, count) {
  const list = get();
  const idx = list.findIndex(i => i._id === _id);
  if (idx > -1) {
    if (count <= 0) list.splice(idx, 1);
    else list[idx].count = count;
    save(list);
  }
}

function remove(_id) {
  const list = get().filter(i => i._id !== _id);
  save(list);
}

function clear() { save([]); }

function totalCount() {
  return get().reduce((s, i) => s + i.count, 0);
}

function totalPrice() {
  return get().reduce((s, i) => s + i.price * i.count, 0);
}

module.exports = { get, save, add, update, remove, clear, totalCount, totalPrice };
