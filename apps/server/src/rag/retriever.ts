import { db } from '../db/index.js';
import { products, orders } from '../db/schema.js';
import { eq, and, ilike, desc } from 'drizzle-orm';
import { generateEmbedding } from './embeddings.js';
import { searchProductsByVector } from '../db/vector.js';

export async function retrieveProducts(query: string, marketId: string, limit: number = 5) {
  const queryEmbedding = await generateEmbedding(query);
  const semanticResults = await searchProductsByVector(queryEmbedding, marketId, limit);

  const keywordResults = await db.select().from(products)
    .where(and(eq(products.marketId, marketId), ilike(products.name, `%${query}%`)))
    .limit(limit);

  const seen = new Set<string>();
  const merged: any[] = [];
  for (const p of semanticResults) {
    if (!seen.has(p.id)) { seen.add(p.id); merged.push({ ...p, source: 'semantic' }); }
  }
  for (const p of keywordResults) {
    if (!seen.has(p.id)) { seen.add(p.id); merged.push({ ...p, referencePrice: Number(p.referencePrice), source: 'keyword' }); }
  }
  return merged.slice(0, limit);
}

export async function retrieveOrders(userId: string, filters?: { timeRange?: string }) {
  return db.select().from(orders)
    .where(eq(orders.buyerId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(10);
}
