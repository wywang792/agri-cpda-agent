import { desc, eq } from 'drizzle-orm';
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

function normalizeMessages(value: unknown): ConversationMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((message) => normalizeMessage(message))
    .filter((message): message is ConversationMessage => message !== null);
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
): Promise<CurrentConversationResponse | null> {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conversation || conversation.userId !== userId) {
    return null;
  }

  return toCurrentConversationResponse(conversation);
}

export async function appendConversationMessage(
  conversationId: string,
  message: ConversationMessage,
): Promise<CurrentConversationResponse | null> {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conversation) {
    return null;
  }

  const normalizedMessage = normalizeMessage(message);
  if (!normalizedMessage) {
    throw new Error('Invalid conversation message');
  }

  const messages = [...normalizeMessages(conversation.messages), normalizedMessage];
  const [updatedConversation] = await db
    .update(conversations)
    .set({ messages, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId))
    .returning();

  return toCurrentConversationResponse(updatedConversation);
}

export function toAgentHistory(messages: ConversationMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return normalizeMessages(messages)
    .filter((message): message is ConversationMessage & { role: 'user' | 'assistant' } => (
      message.role === 'user' || message.role === 'assistant'
    ))
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

export function getLatestOrderDraft(messages: ConversationMessage[]): OrderDraft | null {
  const normalizedMessages = normalizeMessages(messages);

  for (let index = normalizedMessages.length - 1; index >= 0; index -= 1) {
    const orderDraft = normalizedMessages[index]?.metadata?.orderDraft;
    if (orderDraft) {
      return orderDraft;
    }
  }

  return null;
}
