import { db } from '../../db/index.js';
import { products, supplierProducts } from '../../db/schema.js';
import { eq, and, ilike } from 'drizzle-orm';

export async function listProducts(marketId: string, search?: string) {
  const conditions = [eq(products.marketId, marketId)];
  if (search) conditions.push(ilike(products.name, `%${search}%`));
  return db.select().from(products).where(and(...conditions));
}

export async function listProductPrices(marketId: string, search?: string) {
  const baseProducts = await listProducts(marketId, search);
  const rows = [];

  for (const product of baseProducts) {
    const [supplierPrice] = await db
      .select()
      .from(supplierProducts)
      .where(eq(supplierProducts.productId, product.id))
      .limit(1);

    rows.push({
      id: product.id,
      name: product.name,
      category: product.category,
      unit: product.unit,
      referencePrice: Number(product.referencePrice),
      supplierPrice: supplierPrice ? Number(supplierPrice.price) : undefined,
      stock: supplierPrice?.stock,
    });
  }

  return rows;
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
