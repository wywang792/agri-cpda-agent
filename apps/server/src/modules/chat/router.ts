import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { authMiddleware } from '../../middleware/auth.js';
import { buildAgentGraph } from '../../agent/graph.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export const chatRouter = new Hono();
chatRouter.use('*', authMiddleware);

const agentGraph = buildAgentGraph();

chatRouter.post('/stream', async (c) => {
  const { message, conversationId } = await c.req.json();
  const userId = c.get('userId');
  const userRole = c.get('userRole');

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const marketId = user?.marketId || '';

  return streamSSE(c, async (stream) => {
    try {
      await stream.writeSSE({ event: 'start', data: JSON.stringify({ status: 'processing' }) });

      const result = await agentGraph.invoke({
        message, userId, userRole, marketId, conversationId,
        intent: null, entities: null, context: '', response: '',
        orderPreview: null, suggestions: [], history: [],
      });

      const fullResponse = result.response;
      const chunkSize = 10;
      for (let i = 0; i < fullResponse.length; i += chunkSize) {
        const chunk = fullResponse.slice(i, i + chunkSize);
        await stream.writeSSE({ event: 'text', data: JSON.stringify({ content: chunk }) });
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (result.orderPreview) {
        await stream.writeSSE({ event: 'order_preview', data: JSON.stringify(result.orderPreview) });
      }

      if (result.suggestions?.length > 0) {
        await stream.writeSSE({ event: 'suggestions', data: JSON.stringify(result.suggestions) });
      }

      await stream.writeSSE({
        event: 'done',
        data: JSON.stringify({ intent: result.intent, fullResponse: result.response }),
      });
    } catch (error: any) {
      await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: error.message }) });
    }
  });
});
