import { apiRequest } from './api';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface CurrentConversationResponse {
  conversationId: string;
  messages: ConversationMessage[];
}

export async function getCurrentConversation(): Promise<CurrentConversationResponse> {
  return apiRequest<CurrentConversationResponse>('/api/chat/current');
}
