import { db } from '../db/index.js';
import { products, orders } from '../db/schema.js';
import { eq, and, ilike, desc } from 'drizzle-orm';
import { generateEmbedding } from './embeddings.js';
import { searchProductsByVector } from '../db/vector.js';
import { withTimeout } from '../agent/timeout.js';
import { getLLMTimeoutMs } from '../llm/provider.js';

export async function retrieveProducts(query: string, marketId: string, limit: number = 5) {
  console.log(`[RAG] retrieveProducts:start query="${query}" marketId=${marketId}`);
  let semanticResults: Array<{ id: string; name: string; category: string; similarity: number }> = [];

  const keywordResults = await db.select().from(products)
    .where(and(eq(products.marketId, marketId), ilike(products.name, `%${query}%`)))
    .limit(limit);

  if (process.env.ENABLE_SEMANTIC_SEARCH === 'true') {
    try {
      const queryEmbedding = await withTimeout(
        generateEmbedding(query),
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

export async function retrieveOrders(userId: string, filters?: { timeRange?: string }) {
  console.log(`[RAG] retrieveOrders:start userId=${userId}`);
  return db.select().from(orders)
    .where(eq(orders.buyerId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(10);
}
