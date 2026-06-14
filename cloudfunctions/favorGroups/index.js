// favorGroups - 收藏分组管理
const { cloud, ok, BizError, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { action = 'list', groupId, name, goodsId } = event;
  const db = cloud.database();
  const _ = db.command;

  if (action === 'list') {
    const groups = await db.collection('favorGroups')
      .where({ _openid: event._openid })
      .orderBy('createTime', 'asc')
      .get();
    // 关联收藏数
    const favs = await db.collection('favorites')
      .where({ _openid: event._openid })
      .get();
    const result = groups.data.map(g => ({
      ...g,
      count: favs.data.filter(f => (f.groupId || 'default') === g._id).length
    }));
    // 默认分组
    const defaultCount = favs.data.filter(f => !f.groupId || f.groupId === 'default').length;
    if (defaultCount > 0) {
      result.unshift({ _id: 'default', name: '默认收藏夹', count: defaultCount, isDefault: true });
    }
    return ok(result);
  }

  if (action === 'create') {
    if (!name) throw new BizError('分组名必填');
    const res = await db.collection('favorGroups').add({
      data: { _openid: event._openid, name, createTime: Date.now() }
    });
    return ok({ _id: res._id });
  }

  if (action === 'delete') {
    if (!groupId || groupId === 'default') throw new BizError('默认分组不能删除');
    // 收藏归到默认
    await db.collection('favorites').where({
      _openid: event._openid, groupId
    }).update({ data: { groupId: 'default' } });
    await db.collection('favorGroups').doc(groupId).remove();
    return ok();
  }

  if (action === 'move') {
    if (!goodsId) throw new BizError('goodsId 必填');
    if (!groupId) throw new BizError('groupId 必填');
    await db.collection('favorites').where({
      _openid: event._openid, goodsId
    }).update({ data: { groupId, updateTime: Date.now() } });
    return ok();
  }

  return fail('未知 action');
});
