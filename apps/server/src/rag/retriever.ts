import { db } from '../db/index.js';
import { products, orders } from '../db/schema.js';
import { eq, and, ilike, desc, or, gte, lt } from 'drizzle-orm';
import { generateEmbedding } from './embeddings.js';
import { searchProductsByVector } from '../db/vector.js';
import { withTimeout } from '../agent/timeout.js';
import { getLLMTimeoutMs } from '../llm/provider.js';
import type { UserRole } from '@agent-xfd/shared';

export function normalizeProductQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return '';

  if (/今天价格怎么样|今日价格|价格怎么样|有哪些菜|有什么菜|菜品|商品列表|列出.*菜|列出.*商品/.test(trimmed)) {
    return '';
  }

  return trimmed;
}

export async function retrieveProducts(query: string, marketId: string, limit: number = 5) {
  const normalizedQuery = normalizeProductQuery(query);
  console.log(`[RAG] retrieveProducts:start query="${normalizedQuery}" marketId=${marketId}`);
  let semanticResults: Array<{ id: string; name: string; category: string; similarity: number }> = [];

  const keywordResults = await db.select().from(products)
    .where(and(eq(products.marketId, marketId), ilike(products.name, `%${normalizedQuery}%`)))
    .limit(limit);

  if (normalizedQuery && process.env.ENABLE_SEMANTIC_SEARCH === 'true') {
    try {
      const queryEmbedding = await withTimeout(
        generateEmbedding(normalizedQuery),
        getLLMTimeoutMs(),
        'product embedding'
      );
      semanticResults = await withTimeout(
        searchProductsByVector(queryEmbedding, marketId, limit),
        getLLMTimeoutMs(),
        'product vector search'
      );
    } catch (error: any) {
      console.warn(`[RAG] semantic search skipped: ${error.message}`);
    }
  }

  const seen = new Set<string>();
  const merged: any[] = [];
  for (const p of semanticResults) {
    if (!seen.has(p.id)) { seen.add(p.id); merged.push({ ...p, source: 'semantic' }); }
  }
  for (const p of keywordResults) {
    if (!seen.has(p.id)) { seen.add(p.id); merged.push({ ...p, referencePrice: Number(p.referencePrice), source: 'keyword' }); }
  }
  console.log(`[RAG] retrieveProducts:done ${merged.length} results`);
  return merged.slice(0, limit);
}

export function getOrderTimeRangeBounds(timeRange?: string): { start: Date; end: Date } | null {
  if (!timeRange) return null;

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (/昨天/.test(timeRange)) {
    start.setDate(start.getDate() - 1);
  } else if (!/今天|今日|当日/.test(timeRange)) {
    return null;
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function retrieveOrders(
  userId: string,
  role: UserRole,
  filters?: { timeRange?: string },
) {
  console.log(`[RAG] retrieveOrders:start userId=${userId} role=${role} timeRange=${filters?.timeRange || '-'}`);

  const conditions = [];
  if (role === 'buyer') {
    conditions.push(eq(orders.buyerId, userId));
  } else if (role === 'supplier') {
    conditions.push(eq(orders.supplierId, userId));
  } else {
    conditions.push(or(eq(orders.buyerId, userId), eq(orders.supplierId, userId))!);
  }

  const range = getOrderTimeRangeBounds(filters?.timeRange);
  if (range) {
    conditions.push(gte(orders.createdAt, range.start));
    conditions.push(lt(orders.createdAt, range.end));
  }

  return db.select().from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(10);
}
