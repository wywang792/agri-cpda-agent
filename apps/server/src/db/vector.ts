import { db } from './index.js';
import { sql } from 'drizzle-orm';

export async function enablePgVector(): Promise<void> {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
}

export async function storeProductEmbedding(
  productId: string,
  embedding: number[]
): Promise<void> {
  const embeddingStr = JSON.stringify(embedding);
  await db.execute(
    sql`UPDATE products SET embedding = ${embeddingStr}::vector WHERE id = ${productId}`
  );
}

export async function searchProductsByVector(
  queryEmbedding: number[],
  marketId: string,
  limit: number = 5
): Promise<Array<{ id: string; name: string; category: string; similarity: number }>> {
  const embeddingStr = JSON.stringify(queryEmbedding);
  const results = await db.execute(sql`
    SELECT id, name, category,
           1 - (embedding <=> ${embeddingStr}::vector) as similarity
    FROM products
    WHERE market_id = ${marketId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `);
  return results.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    category: String(row.category),
    similarity: Number(row.similarity),
  }));
}
