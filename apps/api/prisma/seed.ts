import { AdminRole, CouponType, PrismaClient, PriceType, StaffStatus } from '@prisma/client';
import { hashPassword } from '../src/common/utils/password.util';

const prisma = new PrismaClient();

/** 种子数据：保证新环境拉起后即可开发调试 */
async function main() {
  console.log('开始写入种子数据...');

  // 1. 行政区划（以上海为例）
  const shanghai = await prisma.region.upsert({
    where: { code: '310000' },
    update: {},
    create: { code: '310000', name: '上海市', level: 1, isServed: true, sort: 1 },
  });

  const shanghaiCity = await prisma.region.upsert({
    where: { code: '310100' },
    update: {},
    create: { code: '310100', name: '上海市', level: 2, parentId: shanghai.id, isServed: true, sort: 1 },
  });

  const districts = [
    { code: '310115', name: '浦东新区' },
    { code: '310104', name: '徐汇区' },
    { code: '310101', name: '黄浦区' },
  ];

  const createdDistricts = [];
  for (const d of districts) {
    const region = await prisma.region.upsert({
      where: { code: d.code },
      update: {},
      create: { code: d.code, name: d.name, level: 3, parentId: shanghaiCity.id, isServed: true },
    });
    createdDistricts.push(region);
  }

  // 2. 示例小区（仅浦东新区开通服务）
  const pudong = createdDistricts[0];
  const communities = [
    { name: '张江集电港人才公寓', address: '浦东新区张江镇科苑路 399 号', lng: 121.5947, lat: 31.2033 },
    { name: '联洋年华园', address: '浦东新区花木街道芳甸路 333 弄', lng: 121.5443, lat: 31.2261 },
  ];

  for (const c of communities) {
    const exists = await prisma.community.findFirst({ where: { regionId: pudong.id, name: c.name } });
    if (!exists) {
      await prisma.community.create({
        data: {
          regionId: pudong.id,
          name: c.name,
          address: c.address,
          lng: c.lng,
          lat: c.lat,
          isServed: true,
        },
      });
    }
  }

  // 3. 服务分类
  const categoryDefs = [
    { name: '日常保洁', sort: 1 },
    { name: '深度保洁', sort: 2 },
    { name: '家电清洗', sort: 3 },
  ];

  const categories: Record<string, bigint> = {};
  for (const def of categoryDefs) {
    const exists = await prisma.category.findFirst({ where: { name: def.name } });
    const category = exists ?? (await prisma.category.create({ data: def }));
    categories[def.name] = category.id;
  }

  // 4. 服务与规格（幂等：已存在则跳过）
  const serviceDefs = [
    {
      category: '日常保洁',
      name: '日常保洁',
      subtitle: '日常清洁打扫，按小时计费',
      priceType: PriceType.DURATION,
      durationMinutes: 180,
      includedItems: ['客厅卧室地面清洁', '厨房台面清洁', '卫生间清洁', '垃圾清理'],
      excludedItems: ['高空外墙玻璃', '家电内部拆洗', '搬家搬运'],
      notice: '如需清洁家电内部，请另选家电清洗服务',
      skus: [
        { name: '2 小时', price: 11900n, durationMinutes: 120, isDefault: false, sort: 1 },
        { name: '3 小时', price: 15900n, durationMinutes: 180, isDefault: true, sort: 2 },
        { name: '4 小时', price: 19900n, durationMinutes: 240, isDefault: false, sort: 3 },
      ],
    },
    {
      category: '深度保洁',
      name: '深度保洁',
      subtitle: '厨房卫生间深度除垢，按房屋面积计费',
      priceType: PriceType.AREA,
      durationMinutes: 240,
      includedItems: ['厨房重油污清洁', '卫生间除垢消毒', '门窗玻璃内侧清洁', '地面深度清洁'],
      excludedItems: ['外墙玻璃', '天花板高处作业'],
      notice: '复式或别墅请选择两单',
      skus: [
        { name: '一居室（60㎡以内）', price: 39900n, durationMinutes: 240, areaMin: 0, areaMax: 60, isDefault: false, sort: 1 },
        { name: '两居室（60-90㎡）', price: 49900n, durationMinutes: 300, areaMin: 60, areaMax: 90, isDefault: true, sort: 2 },
        { name: '三居室（90-130㎡）', price: 69900n, durationMinutes: 360, areaMin: 90, areaMax: 130, isDefault: false, sort: 3 },
      ],
    },
    {
      category: '家电清洗',
      name: '油烟机清洗',
      subtitle: '拆洗滤网与外壳，去除重油污',
      priceType: PriceType.PIECE,
      durationMinutes: 60,
      includedItems: ['滤网拆洗', '外壳清洁', '油杯清理'],
      excludedItems: ['电机拆解维修', '管道改造'],
      notice: '若设备老化严重，清洗前会与您确认风险',
      skus: [
        { name: '单台', price: 15900n, durationMinutes: 60, isDefault: true, sort: 1 },
        { name: '两台', price: 29900n, durationMinutes: 120, isDefault: false, sort: 2 },
      ],
    },
  ];

  const services: Record<string, bigint> = {};
  for (const def of serviceDefs) {
    const exists = await prisma.service.findFirst({ where: { name: def.name } });
    if (exists) {
      services[def.name] = exists.id;
      continue;
    }

    const prices = def.skus.map((s) => s.price);
    const service = await prisma.service.create({
      data: {
        categoryId: categories[def.category],
        name: def.name,
        subtitle: def.subtitle,
        priceType: def.priceType,
        durationMinutes: def.durationMinutes,
        basePriceMin: prices.reduce((a, b) => (a < b ? a : b)),
        basePriceMax: prices.reduce((a, b) => (a > b ? a : b)),
        includedItems: def.includedItems,
        excludedItems: def.excludedItems,
        notice: def.notice,
        sort: Object.keys(services).length + 1,
        skus: { create: def.skus },
      },
    });
    services[def.name] = service.id;
  }

  // 5. 附加项与关联
  const addonDefs = [
    { name: '擦玻璃', price: 5000n, unit: '项', durationMinutes: 30, sort: 1 },
    { name: '冰箱清理', price: 3000n, unit: '台', durationMinutes: 30, sort: 2 },
    { name: '除螨', price: 4000n, unit: '项', durationMinutes: 30, sort: 3 },
    { name: '空调清洗', price: 8000n, unit: '台', durationMinutes: 40, sort: 4 },
  ];

  const addons: Record<string, bigint> = {};
  for (const def of addonDefs) {
    const exists = await prisma.serviceAddon.findFirst({ where: { name: def.name } });
    const addon = exists ?? (await prisma.serviceAddon.create({ data: def }));
    addons[def.name] = addon.id;
  }

  const relDefs = [
    { service: '日常保洁', addons: ['擦玻璃', '冰箱清理', '除螨', '空调清洗'] },
    { service: '深度保洁', addons: ['擦玻璃', '空调清洗'] },
    { service: '油烟机清洗', addons: [] as string[] },
  ];

  for (const rel of relDefs) {
    let sort = 1;
    for (const addonName of rel.addons) {
      await prisma.serviceAddonRel.upsert({
        where: {
          serviceId_addonId: {
            serviceId: services[rel.service],
            addonId: addons[addonName],
          },
        },
        update: {},
        create: {
          serviceId: services[rel.service],
          addonId: addons[addonName],
          sort: sort++,
        },
      });
    }
  }

  // 6. 价格规则（上海）
  await prisma.priceRule.upsert({
    where: { cityCode: '310000' },
    update: {},
    create: {
      cityCode: '310000',
      floorFeeRule: { freeFloor: 1, perFloorAmount: 500 },
      distanceFeeRule: { freeKm: 5, perKmAmount: 200 },
      holidayDates: [],
      holidayRatePercent: 120,
      nightStartHour: 20,
      nightRatePercent: 110,
    },
  });

  // 7. 未来 7 天的时段库存
  // 注意：serviceDate 是 DATE 列，必须用 UTC 零点构造日期，
  // 否则本地时区（UTC+8）换算会让同一条数据在重复执行时被判定为不同日期或冲突。
  const servedDistricts = ['310115', '310104'];
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  const slotData = [];
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() + dayOffset);

    for (const districtCode of servedDistricts) {
      // 排班时段：08:00 – 19:00 起始（最后一个时段为 19:00-20:00）
      for (let hour = 8; hour < 20; hour++) {
        slotData.push({
          serviceDate: date,
          startTime: `${String(hour).padStart(2, '0')}:00`,
          endTime: `${String(hour + 1).padStart(2, '0')}:00`,
          districtCode,
          capacity: 4,
        });
      }
    }
  }

  // 先清理未被占用的历史时段，保证种子数据干净且可重复执行（不删已被订单占用的时段）
  await prisma.timeSlot.deleteMany({
    where: { districtCode: { in: servedDistricts }, used: 0, locked: 0 },
  });

  await prisma.timeSlot.createMany({ data: slotData, skipDuplicates: true });
  const slotCount = slotData.length;

  // 8. 新客券
  const couponExists = await prisma.coupon.findFirst({ where: { name: '新客首单立减 20 元' } });
  if (!couponExists) {
    await prisma.coupon.create({
      data: {
        name: '新客首单立减 20 元',
        type: CouponType.FIXED,
        value: 2000n,
        minAmount: 9900n,
        totalQty: 10000,
        validType: 2,
        validDays: 30,
      },
    });
  }

  // 9. 保洁师（开发账号：用 code = staff_dev001 登录）
  const staffDefs = [
    {
      openid: 'mock_openid_staff_dev001',
      name: '李阿姨',
      phone: '13800000001',
      skillTags: ['日常保洁', '深度保洁'],
      serviceDistricts: ['310115', '310104'],
      ratingX10: 49,
      acceptRate: 96,
      onTimeRate: 98,
      maxDailyOrders: 4,
    },
    {
      openid: 'mock_openid_staff_dev002',
      name: '王阿姨',
      phone: '13800000002',
      skillTags: ['日常保洁', '深度保洁'],
      serviceDistricts: ['310115', '310104'],
      ratingX10: 47,
      acceptRate: 92,
      onTimeRate: 95,
      maxDailyOrders: 4,
    },
    {
      openid: 'mock_openid_staff_dev003',
      name: '张师傅',
      phone: '13800000003',
      skillTags: ['家电清洗', '日常保洁'],
      serviceDistricts: ['310115'],
      ratingX10: 48,
      acceptRate: 90,
      onTimeRate: 93,
      maxDailyOrders: 3,
    },
  ];

  for (const def of staffDefs) {
    const exists = await prisma.staff.findFirst({ where: { openid: def.openid } });
    if (!exists) {
      await prisma.staff.create({
        data: {
          openid: def.openid,
          name: def.name,
          phone: def.phone,
          skillTags: def.skillTags,
          serviceDistricts: def.serviceDistricts,
          ratingX10: def.ratingX10,
          acceptRate: def.acceptRate,
          onTimeRate: def.onTimeRate,
          maxDailyOrders: def.maxDailyOrders,
          status: StaffStatus.ACTIVE,
        },
      });
    }
  }

  // 10. 后台管理员（默认账号 admin / admin123，正式环境请立即修改）
  const adminExists = await prisma.adminUser.findFirst({ where: { username: 'admin' } });
  if (!adminExists) {
    await prisma.adminUser.create({
      data: {
        username: 'admin',
        passwordHash: hashPassword('admin123'),
        name: '超级管理员',
        role: AdminRole.SUPER_ADMIN,
      },
    });
  }

  console.log('种子数据写入完成：');
  console.log(`  行政区划：${await prisma.region.count()} 条`);
  console.log(`  小区：${await prisma.community.count()} 条`);
  console.log(`  服务分类：${await prisma.category.count()} 个`);
  console.log(`  服务：${await prisma.service.count()} 个，规格：${await prisma.serviceSku.count()} 个`);
  console.log(`  附加项：${await prisma.serviceAddon.count()} 个，关联：${await prisma.serviceAddonRel.count()} 条`);
  console.log(`  价格规则：${await prisma.priceRule.count()} 条，时段库存处理：${slotCount} 个`);
  console.log(`  优惠券：${await prisma.coupon.count()} 张`);
  console.log(`  保洁师：${await prisma.staff.count()} 名（开发登录 code：staff_dev001 / staff_dev002 / staff_dev003）`);
  console.log(`  后台账号：${await prisma.adminUser.count()} 个（默认 admin / admin123）`);
}

main()
  .catch((e) => {
    console.error('种子数据写入失败：', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
