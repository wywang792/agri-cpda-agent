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
  console.log('[Chat] >>> POST /api/chat/stream received');

  try {
    const body = await c.req.json();
    console.log('[Chat] Request body:', JSON.stringify(body));

    const { message, conversationId } = body;
    const userId = c.get('userId');
    const userRole = c.get('userRole');
    console.log(`[Chat] userId=${userId}, role=${userRole}, message="${message}"`);

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const marketId = user?.marketId || '';
    console.log(`[Chat] marketId=${marketId}`);

    return streamSSE(c, async (stream) => {
      try {
        console.log('[Chat] Starting SSE stream...');
        await stream.writeSSE({ event: 'start', data: JSON.stringify({ status: 'processing' }) });

        console.log('[Chat] Invoking agent graph...');
        const result = await agentGraph.invoke({
          message, userId, userRole, marketId, conversationId,
          intent: null, entities: null, context: '', response: '',
          orderPreview: null, suggestions: [], history: [],
        });

        console.log(`[Chat] Agent done. intent=${result.intent}, response length=${result.response?.length}`);

        const fullResponse = result.response;
        const chunkSize = 10;
        for (let i = 0; i < fullResponse.length; i += chunkSize) {
          const chunk = fullResponse.slice(i, i + chunkSize);
          await stream.writeSSE({ event: 'text', data: JSON.stringify({ content: chunk }) });
          await new Promise((resolve) => setTimeout(resolve, 30));
        }

        await stream.writeSSE({
          event: 'done',
          data: JSON.stringify({ intent: result.intent, fullResponse: result.response }),
        });
        console.log('[Chat] SSE stream completed');
      } catch (error: any) {
        console.error('[Chat] Agent error:', error.message, error.stack);
        await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: error.message }) });
      }
    });
  } catch (error: any) {
    console.error('[Chat] Request parse error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});