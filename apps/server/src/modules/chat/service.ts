import { and, desc, eq } from 'drizzle-orm';
import type { AgentIntent } from '@agent-xfd/shared';
import { db } from '../../db/index.js';
import { conversations } from '../../db/schema.js';
import type { ConversationMessage, CurrentConversationResponse, OrderDraft } from './types.js';

type ConversationRow = typeof conversations.$inferSelect;

const messageRoles = new Set<ConversationMessage['role']>(['user', 'assistant', 'system']);

function normalizeTimestamp(value: unknown): string {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return value;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return new Date().toISOString();
}

function normalizeMessage(value: unknown): ConversationMessage | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  if (!messageRoles.has(raw.role as ConversationMessage['role']) || typeof raw.content !== 'string') {
    return null;
  }

  const message: ConversationMessage = {
    role: raw.role as ConversationMessage['role'],
    content: raw.content,
    timestamp: normalizeTimestamp(raw.timestamp),
  };

  if (raw.metadata && typeof raw.metadata === 'object') {
    message.metadata = raw.metadata as ConversationMessage['metadata'];
  }

  return message;
}

export function normalizeMessages(value: unknown): ConversationMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((message) => {
      if (typeof message === 'string') {
        try {
          const parsed = JSON.parse(message);
          return normalizeMessages(Array.isArray(parsed) ? parsed : [parsed]);
        } catch {
          return [];
        }
      }

      return [normalizeMessage(message)];
    })
    .filter((message): message is ConversationMessage => message !== null);
}

function isOrderDraft(value: unknown): value is OrderDraft {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as OrderDraft).items));
}

function toCurrentConversationResponse(row: ConversationRow): CurrentConversationResponse {
  const messages = normalizeMessages(row.messages);

  return {
    id: row.id,
    userId: row.userId,
    messages,
    orderDraft: getLatestOrderDraft(messages),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getOrCreateCurrentConversation(userId: string): Promise<CurrentConversationResponse> {
  const [currentConversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(1);

  if (currentConversation) {
    return toCurrentConversationResponse(currentConversation);
  }

  const [createdConversation] = await db
    .insert(conversations)
    .values({ userId, messages: [] })
    .returning();

  return toCurrentConversationResponse(createdConversation);
}

export async function getConversationForUser(
  conversationId: string,
  userId: string,
): Promise<CurrentConversationResponse> {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conversation || conversation.userId !== userId) {
    throw new Error('Conversation not found');
  }

  return toCurrentConversationResponse(conversation);
}

export async function appendConversationMessage(
  conversationId: string,
  userId: string,
  message: ConversationMessage,
): Promise<CurrentConversationResponse> {
  const normalizedMessage = normalizeMessage(message);
  if (!normalizedMessage) {
    throw new Error('Invalid conversation message');
  }

  const conversation = await getConversationForUser(conversationId, userId);
  const messages = [...conversation.messages, normalizedMessage];

  const [updatedConversation] = await db
    .update(conversations)
    .set({
      messages,
      updatedAt: new Date(),
    })
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .returning();

  if (!updatedConversation) {
    throw new Error('Conversation not found');
  }

  return toCurrentConversationResponse(updatedConversation);
}

export function toAgentHistory(messages: ConversationMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return normalizeMessages(messages)
    .filter((message): message is ConversationMessage & { role: 'user' | 'assistant' } => (
      message.role === 'user' || message.role === 'assistant'
    ))
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

export function getLatestOrderDraft(messages: ConversationMessage[]): OrderDraft | null {
  const normalizedMessages = normalizeMessages(messages);

  for (let index = normalizedMessages.length - 1; index >= 0; index -= 1) {
    const metadata = normalizedMessages[index]?.metadata;
    if (!metadata) {
      continue;
    }

    if (
      metadata.orderId ||
      (Object.prototype.hasOwnProperty.call(metadata, 'orderDraft') && metadata.orderDraft === null)
    ) {
      return null;
    }

    const orderDraft = metadata.orderDraft;
    if (isOrderDraft(orderDraft)) {
      return orderDraft;
    }
  }

  return null;
}

export function getPersistedOrderDraft(intent: AgentIntent | null | undefined, orderDraft: OrderDraft | null | undefined): OrderDraft | null {
  if (intent !== 'place_order' && intent !== 'confirm_order') {
    return null;
  }

  return orderDraft || null;
}
