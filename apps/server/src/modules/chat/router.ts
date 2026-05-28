import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { authMiddleware } from '../../middleware/auth.js';
import { buildAgentGraph } from '../../agent/graph.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import {
  appendConversationMessage,
  createConversation,
  getConversationForUser,
  getLatestOrderDraft,
  getOrCreateCurrentConversation,
  getPersistedOrderDraft,
  toAgentHistory,
} from './service.js';

type AuthVariables = {
  userId: string;
  userRole: 'buyer' | 'supplier';
};

export const chatRouter = new Hono<{ Variables: AuthVariables }>();
chatRouter.use('*', authMiddleware);

const agentGraph = buildAgentGraph();

chatRouter.get('/current', async (c) => {
  const userId = c.get('userId');
  const conversation = await getOrCreateCurrentConversation(userId);

  return c.json({
    conversationId: conversation.id,
    messages: conversation.messages,
  });
});

chatRouter.post('/conversations', async (c) => {
  const userId = c.get('userId');
  const conversation = await createConversation(userId);

  return c.json({
    conversationId: conversation.id,
    messages: conversation.messages,
  }, 201);
});

chatRouter.post('/stream', async (c) => {
  console.log('[Chat] >>> POST /api/chat/stream received');

  try {
    const body = await c.req.json();
    console.log('[Chat] Request body:', JSON.stringify(body));

    const { message, conversationId } = body;
    const userId = c.get('userId');
    const userRole = c.get('userRole');
    console.log(`[Chat] userId=${userId}, role=${userRole}, conversationId=${conversationId || 'current'}, message="${message}"`);

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const marketId = user?.marketId || '';
    console.log(`[Chat] marketId=${marketId}`);

    const initialConversation = conversationId
      ? await getConversationForUser(conversationId, userId)
      : await getOrCreateCurrentConversation(userId);

    await appendConversationMessage(initialConversation.id, userId, {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });

    const conversation = await getConversationForUser(initialConversation.id, userId);
    const history = toAgentHistory(conversation.messages);
    const orderDraft = getLatestOrderDraft(conversation.messages) || conversation.orderDraft;
    console.log(`[Chat] conversation=${conversation.id}, history=${history.length}`);

    return streamSSE(c, async (stream) => {
      try {
        console.log('[Chat] Starting SSE stream...');
        await stream.writeSSE({ event: 'start', data: JSON.stringify({ status: 'processing' }) });

        console.log('[Chat] Invoking agent graph...');
        const result = await agentGraph.invoke({
          message, userId, userRole, marketId, conversationId: conversation.id,
          intent: null, entities: null, context: '', response: '',
          orderPreview: null,
          orderDraft,
          createdOrder: null,
          missingFields: [],
          suggestions: [],
          history,
        });

        console.log(`[Chat] Agent done. intent=${result.intent}, response length=${result.response?.length}`);

        const order = result.createdOrder || result.orderPreview || null;
        const persistedOrderDraft = getPersistedOrderDraft(result.intent, result.orderDraft || null);
        await appendConversationMessage(conversation.id, userId, {
          role: 'assistant',
          content: result.response,
          timestamp: new Date().toISOString(),
          metadata: {
            intent: result.intent,
            orderDraft: persistedOrderDraft,
            orderId: order?.id,
            order,
          },
        });

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
        try {
          await appendConversationMessage(conversation.id, userId, {
            role: 'assistant',
            content: error.message || 'Assistant response failed',
            timestamp: new Date().toISOString(),
            metadata: { error: error.message },
          });
        } catch (persistError: any) {
          console.error('[Chat] Failed to persist assistant error:', persistError.message);
        }
        await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: error.message }) });
      }
    });
  } catch (error: any) {
    console.error('[Chat] Request parse error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});
