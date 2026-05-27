import { db } from './index.js';
import { markets, users, products, supplierProducts } from './schema.js';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('Seeding database...');

  const [market] = await db.insert(markets)
    .values({ name: '城东农产品批发市场', address: '城东区市场路1号' })
    .returning();
  console.log(`Created market: ${market.name}`);

  const passwordHash = await bcrypt.hash('123456', 10);
  const [buyer] = await db.insert(users)
    .values({ username: 'buyer1', passwordHash, role: 'buyer', marketId: market.id })
    .returning();
  const [supplier] = await db.insert(users)
    .values({ username: 'supplier1', passwordHash, role: 'supplier', marketId: market.id })
    .returning();
  console.log('Created users: buyer1, supplier1');

  const productList = [
    { name: '土豆', category: '根茎类', unit: '斤', referencePrice: '2.50' },
    { name: '西红柿', category: '茄果类', unit: '斤', referencePrice: '3.00' },
    { name: '白菜', category: '叶菜类', unit: '斤', referencePrice: '1.20' },
    { name: '胡萝卜', category: '根茎类', unit: '斤', referencePrice: '2.00' },
    { name: '黄瓜', category: '瓜类', unit: '斤', referencePrice: '2.80' },
  ];

  const inserted = await db.insert(products)
    .values(productList.map((p) => ({ ...p, marketId: market.id })))
    .returning();
  console.log(`Created ${inserted.length} products`);

  await db.insert(supplierProducts).values(
    inserted.map((p) => ({
      supplierId: supplier.id, productId: p.id,
      price: (Number(p.referencePrice) * 0.9).toFixed(2), stock: 1000,
    }))
  );
  console.log('Created supplier prices');
  console.log('Seed completed!');
  process.exit(0);
}

seed().catch((e) => { console.error('Seed failed:', e); process.exit(1); });
