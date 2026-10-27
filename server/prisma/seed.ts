/**
 * 种子数据脚本
 * 运行: npm run seed
 *
 * 内容:
 *   1. 1 个示例门店 + admin 账号
 *   2. 3 个分类
 *   3. 4 个商品（含规格组）
 *   4. 2 个规格组（杯型、加料）+ 规格选项
 *
 * 重复执行安全：库中已有门店时直接跳过，不注入第二份演示数据。
 */

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

// 简单雪花 ID（基于时间戳 + 随机数，生产用真正的雪花算法）
function genId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${ts}${rand}`.slice(0, 32);
}

async function main() {
  console.log('🌱 Seeding OrderApp...');

  // 幂等保护：已有数据时不重复注入，避免演示环境出现重复门店/商品
  const existing = await prisma.merchant.count();
  if (existing > 0) {
    console.log(`\n⏭  数据库已有 ${existing} 家门店，跳过 seed。`);
    console.log('   需要重置为演示数据：cd server && npx prisma migrate reset --force');
    return;
  }

  // ====== 1. 门店 + admin ======
  const merchant = await prisma.merchant.create({
    data: {
      id: genId('m'),
      name: '示例奶茶店',
      // 模板不附带图片素材：留空时前端渲染内置占位块，避免出现指向不存在域名的请求
      logo: null,
      address: '上海市浦东新区示例路 100 号',
      phone: '13800138000',
      businessHours: '09:00-22:00',
      isOpen: true,
      payOnSiteEnabled: true,
      notice: '欢迎光临！今日新品上市 🎉',
    },
  });
  console.log(`  ✓ 门店 ${merchant.name} (${merchant.id})`);

  const adminPassword = await hash('admin123', 10);
  const adminUser = await prisma.adminUser.create({
    data: {
      id: genId('au'),
      merchantId: merchant.id,
      username: 'admin',
      password: adminPassword,
      role: 'owner',
    },
  });
  console.log(`  ✓ Admin 账号 admin / admin123 (${adminUser.id})`);

  // ====== 2. 分类 ======
  const categories = await Promise.all([
    prisma.category.create({
      data: { id: genId('c'), merchantId: merchant.id, name: '招牌奶茶', sort: 1, visible: true },
    }),
    prisma.category.create({
      data: { id: genId('c'), merchantId: merchant.id, name: '鲜果茶', sort: 2, visible: true },
    }),
    prisma.category.create({
      data: { id: genId('c'), merchantId: merchant.id, name: '小食甜点', sort: 3, visible: true },
    }),
  ]);
  console.log(`  ✓ 分类: ${categories.map((c) => c.name).join(', ')}`);

  // ====== 3. 规格组 + 规格选项 ======
  const cupGroup = await prisma.specGroup.create({
    data: {
      id: genId('g'),
      merchantId: merchant.id,
      name: '杯型',
      type: 'single',
      required: true,
      options: {
        create: [
          { id: genId('o'), name: '中杯', priceDelta: 0, sort: 1 },
          { id: genId('o'), name: '大杯', priceDelta: 300, sort: 2 },
        ],
      },
    },
    include: { options: true },
  });

  const toppingGroup = await prisma.specGroup.create({
    data: {
      id: genId('g'),
      merchantId: merchant.id,
      name: '加料',
      type: 'multi',
      required: false,
      options: {
        create: [
          { id: genId('o'), name: '珍珠', priceDelta: 200, sort: 1 },
          { id: genId('o'), name: '椰果', priceDelta: 200, sort: 2 },
          { id: genId('o'), name: '芋圆', priceDelta: 300, sort: 3 },
        ],
      },
    },
    include: { options: true },
  });
  console.log(`  ✓ 规格组: ${cupGroup.name}, ${toppingGroup.name}`);

  // ====== 4. 商品 ======
  const pearlMilkTea = await prisma.product.create({
    data: {
      id: genId('p'),
      merchantId: merchant.id,
      categoryId: categories[0].id,
      name: '珍珠奶茶',
      description: '经典招牌，香浓奶茶配 Q 弹珍珠',
      image: '/api/v1/static/products/milk-tea.png',
      price: 1500,
      stock: 100,
      onSale: true,
    },
  });

  const taroMilkTea = await prisma.product.create({
    data: {
      id: genId('p'),
      merchantId: merchant.id,
      categoryId: categories[0].id,
      name: '芋泥奶茶',
      description: '浓郁芋泥 + 丝滑奶茶',
      image: '/api/v1/static/products/taro-milk-tea.png',
      price: 1800,
      stock: 50,
      onSale: true,
    },
  });

  const mangoTea = await prisma.product.create({
    data: {
      id: genId('p'),
      merchantId: merchant.id,
      categoryId: categories[1].id,
      name: '芒果青茶',
      description: '新鲜芒果果肉搭配清爽青茶',
      image: '/api/v1/static/products/fruit-tea.png',
      price: 1600,
      stock: 30,
      onSale: true,
    },
  });

  const fries = await prisma.product.create({
    data: {
      id: genId('p'),
      merchantId: merchant.id,
      categoryId: categories[2].id,
      name: '黄金薯条',
      description: '外酥里嫩，配番茄酱',
      image: '/api/v1/static/products/fries.png',
      price: 1200,
      stock: 0, // 售罄
      onSale: true,
    },
  });

  // 关联规格组
  await prisma.productSpecGroup.createMany({
    data: [
      { id: genId('psg'), productId: pearlMilkTea.id, specGroupId: cupGroup.id, sort: 1 },
      { id: genId('psg'), productId: pearlMilkTea.id, specGroupId: toppingGroup.id, sort: 2 },
      { id: genId('psg'), productId: taroMilkTea.id, specGroupId: cupGroup.id, sort: 1 },
      { id: genId('psg'), productId: taroMilkTea.id, specGroupId: toppingGroup.id, sort: 2 },
      { id: genId('psg'), productId: mangoTea.id, specGroupId: cupGroup.id, sort: 1 },
      { id: genId('psg'), productId: mangoTea.id, specGroupId: toppingGroup.id, sort: 2 },
    ],
  });

  console.log(`  ✓ 商品: 珍珠奶茶、芋泥奶茶、芒果青茶、黄金薯条（售罄）`);

  console.log('\n✅ Seed 完成！');
  console.log('\n默认账号:');
  console.log('  商家后台:  admin / admin123');
  console.log(`  门店 ID:  ${merchant.id}`);
  // 小程序码 scene 参数（specs/02-domain.md SceneCodec 格式），本地联调可直接用浏览器带参进入
  console.log(`  扫码 scene:  ${Buffer.from(`merchant_id=${merchant.id}`).toString('base64')}`);
}

main()
  .catch((e) => {
    console.error('Seed 失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
