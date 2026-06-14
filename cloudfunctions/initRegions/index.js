// initRegions - 初始化省市区数据
// 演示数据:一线+新一线城市;正式环境建议导入完整数据(淘宝/民政部公开数据)
const { cloud, ok } = require('../common/index.js');

// 数据格式:省(0) -> 市(省id) -> 区(市id)
const DATA = [
  // 北京
  { id: 110000, name: '北京市', parent: 0, sort: 1, status: 1, level: 1 },
  { id: 110100, name: '市辖区', parent: 110000, sort: 1, status: 1, level: 2 },
  { id: 110101, name: '东城区', parent: 110100, sort: 1, status: 1, level: 3 },
  { id: 110102, name: '西城区', parent: 110100, sort: 2, status: 1, level: 3 },
  { id: 110105, name: '朝阳区', parent: 110100, sort: 3, status: 1, level: 3 },
  { id: 110106, name: '丰台区', parent: 110100, sort: 4, status: 1, level: 3 },
  { id: 110107, name: '石景山区', parent: 110100, sort: 5, status: 1, level: 3 },
  { id: 110108, name: '海淀区', parent: 110100, sort: 6, status: 1, level: 3 },
  { id: 110109, name: '门头沟区', parent: 110100, sort: 7, status: 1, level: 3 },
  { id: 110112, name: '通州区', parent: 110100, sort: 8, status: 1, level: 3 },
  { id: 110113, name: '顺义区', parent: 110100, sort: 9, status: 1, level: 3 },
  { id: 110114, name: '昌平区', parent: 110100, sort: 10, status: 1, level: 3 },

  // 上海
  { id: 310000, name: '上海市', parent: 0, sort: 2, status: 1, level: 1 },
  { id: 310100, name: '市辖区', parent: 310000, sort: 1, status: 1, level: 2 },
  { id: 310101, name: '黄浦区', parent: 310100, sort: 1, status: 1, level: 3 },
  { id: 310104, name: '徐汇区', parent: 310100, sort: 2, status: 1, level: 3 },
  { id: 310105, name: '长宁区', parent: 310100, sort: 3, status: 1, level: 3 },
  { id: 310106, name: '静安区', parent: 310100, sort: 4, status: 1, level: 3 },
  { id: 310107, name: '普陀区', parent: 310100, sort: 5, status: 1, level: 3 },
  { id: 310109, name: '虹口区', parent: 310100, sort: 6, status: 1, level: 3 },
  { id: 310110, name: '杨浦区', parent: 310100, sort: 7, status: 1, level: 3 },
  { id: 310112, name: '闵行区', parent: 310100, sort: 8, status: 1, level: 3 },
  { id: 310113, name: '宝山区', parent: 310100, sort: 9, status: 1, level: 3 },
  { id: 310114, name: '嘉定区', parent: 310100, sort: 10, status: 1, level: 3 },
  { id: 310115, name: '浦东新区', parent: 310100, sort: 11, status: 1, level: 3 },

  // 广东
  { id: 440000, name: '广东省', parent: 0, sort: 3, status: 1, level: 1 },
  { id: 440100, name: '广州市', parent: 440000, sort: 1, status: 1, level: 2 },
  { id: 440103, name: '荔湾区', parent: 440100, sort: 1, status: 1, level: 3 },
  { id: 440104, name: '越秀区', parent: 440100, sort: 2, status: 1, level: 3 },
  { id: 440105, name: '海珠区', parent: 440100, sort: 3, status: 1, level: 3 },
  { id: 440106, name: '天河区', parent: 440100, sort: 4, status: 1, level: 3 },
  { id: 440111, name: '白云区', parent: 440100, sort: 5, status: 1, level: 3 },
  { id: 440112, name: '黄埔区', parent: 440100, sort: 6, status: 1, level: 3 },
  { id: 440113, name: '番禺区', parent: 440100, sort: 7, status: 1, level: 3 },
  { id: 440114, name: '花都区', parent: 440100, sort: 8, status: 1, level: 3 },

  { id: 440300, name: '深圳市', parent: 440000, sort: 2, status: 1, level: 2 },
  { id: 440303, name: '罗湖区', parent: 440300, sort: 1, status: 1, level: 3 },
  { id: 440304, name: '福田区', parent: 440300, sort: 2, status: 1, level: 3 },
  { id: 440305, name: '南山区', parent: 440300, sort: 3, status: 1, level: 3 },
  { id: 440306, name: '宝安区', parent: 440300, sort: 4, status: 1, level: 3 },
  { id: 440307, name: '龙岗区', parent: 440300, sort: 5, status: 1, level: 3 },
  { id: 440308, name: '盐田区', parent: 440300, sort: 6, status: 1, level: 3 },
  { id: 440309, name: '龙华区', parent: 440300, sort: 7, status: 1, level: 3 },
  { id: 440310, name: '坪山区', parent: 440300, sort: 8, status: 1, level: 3 },
  { id: 440311, name: '光明区', parent: 440300, sort: 9, status: 1, level: 3 },

  // 浙江
  { id: 330000, name: '浙江省', parent: 0, sort: 4, status: 1, level: 1 },
  { id: 330100, name: '杭州市', parent: 330000, sort: 1, status: 1, level: 2 },
  { id: 330102, name: '上城区', parent: 330100, sort: 1, status: 1, level: 3 },
  { id: 330105, name: '拱墅区', parent: 330100, sort: 2, status: 1, level: 3 },
  { id: 330106, name: '西湖区', parent: 330100, sort: 3, status: 1, level: 3 },
  { id: 330108, name: '滨江区', parent: 330100, sort: 4, status: 1, level: 3 },
  { id: 330109, name: '萧山区', parent: 330100, sort: 5, status: 1, level: 3 },
  { id: 330110, name: '余杭区', parent: 330100, sort: 6, status: 1, level: 3 },
  { id: 330111, name: '富阳区', parent: 330100, sort: 7, status: 1, level: 3 },
  { id: 330112, name: '临安区', parent: 330100, sort: 8, status: 1, level: 3 },

  // 江苏
  { id: 320000, name: '江苏省', parent: 0, sort: 5, status: 1, level: 1 },
  { id: 320100, name: '南京市', parent: 320000, sort: 1, status: 1, level: 2 },
  { id: 320102, name: '玄武区', parent: 320100, sort: 1, status: 1, level: 3 },
  { id: 320104, name: '秦淮区', parent: 320100, sort: 2, status: 1, level: 3 },
  { id: 320105, name: '建邺区', parent: 320100, sort: 3, status: 1, level: 3 },
  { id: 320106, name: '鼓楼区', parent: 320100, sort: 4, status: 1, level: 3 },

  // 四川
  { id: 510000, name: '四川省', parent: 0, sort: 6, status: 1, level: 1 },
  { id: 510100, name: '成都市', parent: 510000, sort: 1, status: 1, level: 2 },
  { id: 510104, name: '锦江区', parent: 510100, sort: 1, status: 1, level: 3 },
  { id: 510105, name: '青羊区', parent: 510100, sort: 2, status: 1, level: 3 },
  { id: 510106, name: '金牛区', parent: 510100, sort: 3, status: 1, level: 3 },
  { id: 510107, name: '武侯区', parent: 510100, sort: 4, status: 1, level: 3 },
  { id: 510108, name: '成华区', parent: 510100, sort: 5, status: 1, level: 3 },

  // 湖北
  { id: 420000, name: '湖北省', parent: 0, sort: 7, status: 1, level: 1 },
  { id: 420100, name: '武汉市', parent: 420000, sort: 1, status: 1, level: 2 },
  { id: 420102, name: '江岸区', parent: 420100, sort: 1, status: 1, level: 3 },
  { id: 420103, name: '江汉区', parent: 420100, sort: 2, status: 1, level: 3 },
  { id: 420104, name: '硚口区', parent: 420100, sort: 3, status: 1, level: 3 },
  { id: 420105, name: '汉阳区', parent: 420100, sort: 4, status: 1, level: 3 },
  { id: 420106, name: '武昌区', parent: 420100, sort: 5, status: 1, level: 3 },
  { id: 420107, name: '青山区', parent: 420100, sort: 6, status: 1, level: 3 },

  // 陕西
  { id: 610000, name: '陕西省', parent: 0, sort: 8, status: 1, level: 1 },
  { id: 610100, name: '西安市', parent: 610000, sort: 1, status: 1, level: 2 },
  { id: 610102, name: '新城区', parent: 610100, sort: 1, status: 1, level: 3 },
  { id: 610103, name: '碑林区', parent: 610100, sort: 2, status: 1, level: 3 },
  { id: 610104, name: '莲湖区', parent: 610100, sort: 3, status: 1, level: 3 },
  { id: 610111, name: '灞桥区', parent: 610100, sort: 4, status: 1, level: 3 },
  { id: 610112, name: '未央区', parent: 610100, sort: 5, status: 1, level: 3 },
  { id: 610113, name: '雁塔区', parent: 610100, sort: 6, status: 1, level: 3 }
];

exports.main = async (event) => {
  const { force = false } = event;
  const db = cloud.database();
  let inserted = 0;

  for (const r of DATA) {
    try {
      if (force) {
        await db.collection('regions').where({ id: r.id }).remove().catch(() => {});
      }
      const exist = await db.collection('regions').where({ id: r.id }).limit(1).get();
      if (exist.data.length === 0 || force) {
        await db.collection('regions').add({ data: { ...r, createTime: Date.now() } });
        inserted++;
      }
    } catch (e) {}
  }
  return ok({ message: '省市区数据初始化完成', inserted, total: DATA.length });
};
