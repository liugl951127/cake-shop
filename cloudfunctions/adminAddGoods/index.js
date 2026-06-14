const { cloud, ok, BizError, auth, requireAdmin } = require('../common/index.js');

exports.main = auth(async (event) => {
  requireAdmin(event);
  const { name, desc, price, originPrice, image, images, category, stock, sales, recommend, tags, detail, detailImages, status, specs } = event;
  if (!name) throw new BizError('商品名称必填');
  if (!price) throw new BizError('价格必填');
  if (!image) throw new BizError('请上传商品图片');

  const db = cloud.database();
  const res = await db.collection('goods').add({
    data: {
      name,
      desc: desc || '',
      price: Number(price),
      originPrice: originPrice ? Number(originPrice) : 0,
      image,
      images: images || [],
      category: category || '',
      stock: Number(stock) || 0,
      sales: Number(sales) || 0,
      recommend: !!recommend,
      tags: tags || [],
      detail: detail || '',
      detailImages: detailImages || [],
      specs: specs || [],
      status: status !== undefined ? Number(status) : 1,
      createTime: Date.now(),
      updateTime: Date.now()
    }
  });
  return ok({ _id: res._id });
});
