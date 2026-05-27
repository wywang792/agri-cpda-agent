import { db } from '../../db/index.js';
import { products, supplierProducts } from '../../db/schema.js';
import { eq, and, ilike } from 'drizzle-orm';

export async function listProducts(marketId: string, search?: string) {
  const conditions = [eq(products.marketId, marketId)];
  if (search) conditions.push(ilike(products.name, `%${search}%`));
  return db.select().from(products).where(and(...conditions));
}

export async function getProductWithPrice(productId: string, supplierId?: string) {
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!product) return null;

  let supplierPrice: number | undefined;
  if (supplierId) {
    const [sp] = await db.select().from(supplierProducts)
      .where(and(eq(supplierProducts.supplierId, supplierId), eq(supplierProducts.productId, productId)))
      .limit(1);
    supplierPrice = sp ? Number(sp.price) : undefined;
  }

  return { ...product, referencePrice: Number(product.referencePrice), supplierPrice };
}

export async function listSupplierProducts(supplierId: string) {
  return db.select({
    productId: supplierProducts.productId, price: supplierProducts.price,
    stock: supplierProducts.stock, productName: products.name, unit: products.unit,
  }).from(supplierProducts)
    .innerJoin(products, eq(supplierProducts.productId, products.id))
    .where(eq(supplierProducts.supplierId, supplierId));
}
