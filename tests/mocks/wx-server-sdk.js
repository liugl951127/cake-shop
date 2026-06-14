// tests/mocks/wx-server-sdk.js - 模拟云开发 SDK
class Collection {
  constructor(name) { this.name = name; this.data = []; }
  where(where) { this._where = where; return this; }
  orderBy(field, order) { this._orderBy = { field, order }; return this; }
  limit(n) { this._limit = n; return this; }
  skip(n) { this._skip = n; return this; }
  field(data) { Object.assign(this, data); return this; }
  get() { return Promise.resolve({ data: this.data }); }
  count() { return Promise.resolve({ total: this.data.length }); }
  add({ data }) {
    const _id = `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.data.push({ _id, ...data });
    return Promise.resolve({ _id });
  }
  doc(id) { return new Doc(this, id); }
  update({ data }) {
    Object.assign(this._doc, data);
    return Promise.resolve({ stats: { updated: 1 } });
  }
  remove() {
    const idx = this.data.findIndex(d => d._id === this._doc._id);
    if (idx >= 0) this.data.splice(idx, 1);
    return Promise.resolve({ stats: { removed: 1 } });
  }
}

class Doc {
  constructor(coll, id) {
    this._coll = coll;
    this._id = id;
    this._doc = coll.data.find(d => d._id === id) || { _id: id };
  }
  get() { return Promise.resolve({ data: this._doc }); }
  update({ data }) {
    Object.assign(this._doc, data);
    return Promise.resolve({ stats: { updated: 1 } });
  }
  remove() {
    const idx = this._coll.data.findIndex(d => d._id === this._id);
    if (idx >= 0) this._coll.data.splice(idx, 1);
    return Promise.resolve({ stats: { removed: 1 } });
  }
}

const collections = {};

function db() {
  return {
    collection(name) {
      if (!collections[name]) collections[name] = new Collection(name);
      return collections[name];
    },
    command: {
      eq: v => v,
      neq: v => ({ __neq: v }),
      gt: v => ({ __gt: v }),
      gte: v => ({ __gte: v }),
      lt: v => ({ __lt: v }),
      lte: v => ({ __lte: v }),
      in: arr => ({ __in: arr }),
      nin: arr => ({ __nin: arr }),
      inc: n => ({ __inc: n }),
      neq: v => ({ __neq: v }),
      not: v => ({ __not: v })
    },
    RegExp: ({ regexp, options }) => ({ __regexp: regexp, __options: options })
  };
}

module.exports = {
  init: jest.fn(),
  database: db,
  getWXContext: () => ({
    OPENID: 'mock_openid_123',
    UNIONID: 'mock_unionid_456',
    APPID: 'mock_appid',
    ENV: 'test'
  }),
  getTempFileURL: jest.fn().mockResolvedValue({ fileList: [] }),
  uploadFile: jest.fn().mockResolvedValue({ fileID: 'cloud://test.jpg' }),
  cloudPay: {
    unifiedOrder: jest.fn().mockResolvedValue({ payment: { timeStamp: '123', nonceStr: 'abc' } }),
    refund: jest.fn().mockResolvedValue({})
  },
  DYNAMIC_CURRENT_ENV: 'test-env',
  __reset: () => { for (const k in collections) delete collections[k]; }
};
