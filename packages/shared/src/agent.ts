import type { Order } from './order.js';

export type AgentIntent =
  | 'place_order'
  | 'query_order'
  | 'ask_price'
  | 'confirm_order'
  | 'cancel'
  | 'recommend'
  | 'manage_address'
  | 'chat';

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface AgentResponse {
  intent: AgentIntent;
  content: string;
  orderPreview?: Order;
  suggestions?: string[];
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface ChatStreamEvent {
  type: 'text' | 'order_preview' | 'suggestions' | 'done';
  content: string;
  data?: unknown;
}
