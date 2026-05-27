import { db } from '../../db/index.js';
import { orders, orderItems, users, products, supplierProducts } from '../../db/schema.js';
import { eq, and, desc, or } from 'drizzle-orm';
import type { CreateOrderRequest, OrderStatus, UserRole } from '@agent-xfd/shared';

function generateOrderNo(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD-${date}-${rand}`;
}

export async function createOrder(data: CreateOrderRequest, creatorId: string, creatorRole: 'buyer' | 'supplier') {
  const [buyer] = await db.select().from(users).where(eq(users.id, data.buyerId)).limit(1);
  const [supplier] = await db.select().from(users).where(eq(users.id, data.supplierId)).limit(1);
  if (!buyer || !supplier) throw new Error('Invalid buyer or supplier');

  const items = [];
  let totalPrice = 0;
  for (const item of data.items) {
    const [product] = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
    if (!product) throw new Error(`Product ${item.productId} not found`);

    const [sp] = await db.select().from(supplierProducts)
      .where(and(eq(supplierProducts.supplierId, data.supplierId), eq(supplierProducts.productId, item.productId)))
      .limit(1);

    const unitPrice = sp ? Number(sp.price) : Number(product.referencePrice);
    const subtotal = unitPrice * item.quantity;
    totalPrice += subtotal;
    items.push({
      productId: item.productId,
      productName: product.name,
      quantity: item.quantity,
      unit: product.unit,
      unitPrice: unitPrice.toFixed(2),
      subtotal: subtotal.toFixed(2),
    });
  }

  const [order] = await db.insert(orders).values({
    orderNo: generateOrderNo(), creatorId, creatorRole,
    buyerId: data.buyerId, buyerName: buyer.username,
    supplierId: data.supplierId, supplierName: supplier.username,
    totalPrice: totalPrice.toFixed(2), status: 'pending',
    deliveryAddress: data.deliveryAddress,
    deliveryTimeText: data.deliveryTimeText,
    deliveryStartAt: data.deliveryStartAt,
    deliveryEndAt: data.deliveryEndAt,
    remark: data.remark,
    marketId: buyer.marketId,
  }).returning();

  await db.insert(orderItems).values(items.map((item) => ({ orderId: order.id, ...item })));
  return { ...order, items };
}

export async function getOrders(userId: string, filters?: { status?: OrderStatus }) {
  const conditions = [eq(orders.buyerId, userId)];
  if (filters?.status) conditions.push(eq(orders.status, filters.status));
  return db.select().from(orders).where(and(...conditions)).orderBy(desc(orders.createdAt));
}

export async function getOrdersForUser(userId: string, role: UserRole, filters?: { status?: OrderStatus }) {
  const conditions = [];

  if (role === 'buyer') {
    conditions.push(eq(orders.buyerId, userId));
  } else if (role === 'supplier') {
    conditions.push(eq(orders.supplierId, userId));
  } else {
    conditions.push(or(eq(orders.buyerId, userId), eq(orders.supplierId, userId))!);
  }

  if (filters?.status) conditions.push(eq(orders.status, filters.status));

  const rows = await db
    .select()
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt));

  const result = [];
  for (const order of rows) {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    result.push({ ...order, items });
  }

  return result;
}

export async function getOrderDetail(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  return { ...order, items };
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const [updated] = await db.update(orders)
    .set({ status, updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();
  return updated;
}
