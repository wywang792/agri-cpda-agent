import type { Order } from '@agent-xfd/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products, supplierProducts, users } from '../db/schema.js';
import { createOrder } from '../modules/order/service.js';
import type { OrderDraft, OrderDraftItem } from '../modules/chat/types.js';
import type { AgentState, ExtractedEntities } from './types.js';
import { normalizeDeliveryTime } from './deliveryTime.js';

type UserRow = typeof users.$inferSelect;
type ProductRow = typeof products.$inferSelect;

function mergeItems(existing: OrderDraftItem[], incoming: ExtractedEntities['items']): OrderDraftItem[] {
  if (incoming.length === 0) {
    return existing;
  }

  const nextItems = [...existing];
  for (const item of incoming) {
    const normalizedName = item.name.trim();
    if (!normalizedName || item.quantity <= 0) {
      continue;
    }

    const index = nextItems.findIndex((draftItem) => draftItem.productName === normalizedName);
    const nextItem: OrderDraftItem = {
      productName: normalizedName,
      quantity: item.quantity,
      unit: item.unit || '斤',
    };

    if (index >= 0) {
      nextItems[index] = { ...nextItems[index], ...nextItem };
    } else {
      nextItems.push(nextItem);
    }
  }

  return nextItems;
}

export function mergeOrderDraft(
  current: OrderDraft | null | undefined,
  entities: ExtractedEntities | null | undefined,
): OrderDraft {
  const draft: OrderDraft = {
    ...current,
    items: current?.items ? [...current.items] : [],
  };

  if (!entities) {
    return draft;
  }

  draft.items = mergeItems(draft.items, entities.items || []);
  if (entities.buyer) draft.buyerName = entities.buyer;
  if (entities.supplier) draft.supplierName = entities.supplier;
  if (entities.phone) draft.buyerPhone = entities.phone;
  if (entities.deliveryAddress) draft.deliveryAddress = entities.deliveryAddress;
  if (entities.timeRange) {
    const deliveryTime = normalizeDeliveryTime(entities.timeRange);
    if (deliveryTime) {
      draft.deliveryTimeText = deliveryTime.text;
      draft.deliveryStartAt = deliveryTime.startAt;
      draft.deliveryEndAt = deliveryTime.endAt;
    }
  }

  return draft;
}

export function validateOrderDraft(draft: OrderDraft): string[] {
  const missing: string[] = [];

  if (draft.items.length === 0 || draft.items.some((item) => !item.productId || item.quantity <= 0)) {
    missing.push('商品');
  }
  if (!draft.buyerId) missing.push('采购方');
  if (!draft.supplierId) missing.push('供应商');
  if (!draft.deliveryAddress) missing.push('配送地址');

  return missing;
}

async function getMarketProducts(marketId: string): Promise<ProductRow[]> {
  return db.select().from(products).where(eq(products.marketId, marketId));
}

function findProductByName(allProducts: ProductRow[], name: string): ProductRow | undefined {
  return allProducts.find((product) => (
    name.includes(product.name) || product.name.includes(name)
  ));
}

async function findUserByNameOrRole(params: {
  marketId: string;
  name?: string;
  role: UserRow['role'];
}): Promise<UserRow | undefined> {
  const candidates = await db
    .select()
    .from(users)
    .where(and(eq(users.marketId, params.marketId), eq(users.role, params.role)));

  if (!params.name) {
    return candidates[0];
  }

  return candidates.find((user) => (
    user.username.includes(params.name!) || params.name!.includes(user.username)
  )) || candidates[0];
}

async function resolveSupplierForDraft(draft: OrderDraft, state: AgentState): Promise<UserRow | undefined> {
  if (state.userRole === 'supplier') {
    const [currentSupplier] = await db.select().from(users).where(eq(users.id, state.userId)).limit(1);
    return currentSupplier;
  }

  if (draft.supplierName) {
    return findUserByNameOrRole({ marketId: state.marketId, name: draft.supplierName, role: 'supplier' });
  }

  const firstProductId = draft.items.find((item) => item.productId)?.productId;
  if (firstProductId) {
    const [supplierProduct] = await db
      .select()
      .from(supplierProducts)
      .where(eq(supplierProducts.productId, firstProductId))
      .limit(1);

    if (supplierProduct) {
      const [supplier] = await db
        .select()
        .from(users)
        .where(eq(users.id, supplierProduct.supplierId))
        .limit(1);
      if (supplier) return supplier;
    }
  }

  return findUserByNameOrRole({ marketId: state.marketId, role: 'supplier' });
}

async function resolveBuyerForDraft(draft: OrderDraft, state: AgentState): Promise<UserRow | undefined> {
  if (state.userRole === 'buyer') {
    const [currentBuyer] = await db.select().from(users).where(eq(users.id, state.userId)).limit(1);
    return currentBuyer;
  }

  return findUserByNameOrRole({ marketId: state.marketId, name: draft.buyerName, role: 'buyer' });
}

async function resolveItemPrices(draft: OrderDraft): Promise<OrderDraft> {
  if (!draft.supplierId) {
    return draft;
  }

  const items: OrderDraftItem[] = [];
  for (const item of draft.items) {
    if (!item.productId) {
      items.push(item);
      continue;
    }

    const [supplierProduct] = await db
      .select()
      .from(supplierProducts)
      .where(and(
        eq(supplierProducts.supplierId, draft.supplierId),
        eq(supplierProducts.productId, item.productId),
      ))
      .limit(1);

    const unitPrice = supplierProduct ? Number(supplierProduct.price) : item.unitPrice;
    items.push({ ...item, unitPrice });
  }

  const totalPrice = items.reduce((total, item) => total + (item.unitPrice || 0) * item.quantity, 0);
  return { ...draft, items, totalPrice: totalPrice > 0 ? totalPrice : draft.totalPrice };
}

async function resolveOrderDraft(draft: OrderDraft, state: AgentState): Promise<OrderDraft> {
  const allProducts = await getMarketProducts(state.marketId);
  const items = draft.items.map((item) => {
    if (item.productId) return item;

    const product = findProductByName(allProducts, item.productName);
    if (!product) return item;

    return {
      ...item,
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      unitPrice: Number(product.referencePrice),
    };
  });

  let resolvedDraft: OrderDraft = { ...draft, items };

  const supplier = await resolveSupplierForDraft(resolvedDraft, state);
  if (supplier) {
    resolvedDraft = {
      ...resolvedDraft,
      supplierId: supplier.id,
      supplierName: supplier.username,
    };
  }

  const buyer = await resolveBuyerForDraft(resolvedDraft, state);
  if (buyer) {
    resolvedDraft = {
      ...resolvedDraft,
      buyerId: buyer.id,
      buyerName: resolvedDraft.buyerName || buyer.username,
    };
  }

  return resolveItemPrices(resolvedDraft);
}

function normalizeCreatedOrder(order: Awaited<ReturnType<typeof createOrder>>): Order {
  return {
    ...order,
    totalPrice: Number(order.totalPrice),
    deliveryAddress: order.deliveryAddress || '',
    deliveryTimeText: order.deliveryTimeText || undefined,
    deliveryStartAt: order.deliveryStartAt || undefined,
    deliveryEndAt: order.deliveryEndAt || undefined,
    remark: order.remark || undefined,
    items: order.items.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.subtotal),
    })),
  };
}

export async function applyOrderFlow(state: AgentState): Promise<Partial<AgentState>> {
  if (state.intent !== 'place_order' && state.intent !== 'confirm_order') {
    return {};
  }

  const mergedDraft = mergeOrderDraft(state.orderDraft, state.entities);
  const orderDraft = await resolveOrderDraft(mergedDraft, state);
  const missingFields = validateOrderDraft(orderDraft);

  if (state.intent !== 'confirm_order' || missingFields.length > 0) {
    return { orderDraft, missingFields, createdOrder: null };
  }

  const createdOrder = normalizeCreatedOrder(await createOrder(
    {
      buyerId: orderDraft.buyerId!,
      supplierId: orderDraft.supplierId!,
      deliveryAddress: orderDraft.deliveryAddress!,
      deliveryTimeText: orderDraft.deliveryTimeText,
      deliveryStartAt: orderDraft.deliveryStartAt,
      deliveryEndAt: orderDraft.deliveryEndAt,
      items: orderDraft.items.map((item) => ({
        productId: item.productId!,
        quantity: item.quantity,
      })),
    },
    state.userId,
    state.userRole,
  ));

  return { orderDraft: null, createdOrder, missingFields: [] };
}
