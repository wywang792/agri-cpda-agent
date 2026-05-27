import type { AgentIntent, Order } from '@agent-xfd/shared';
import type { OrderDraft } from '../modules/chat/types.js';

export interface AgentState {
  message: string;
  userId: string;
  userRole: 'buyer' | 'supplier';
  marketId: string;
  conversationId?: string;
  intent: AgentIntent | null;
  entities: ExtractedEntities | null;
  context: string;
  response: string;
  orderPreview: Order | null;
  orderDraft?: OrderDraft | null;
  createdOrder?: Order | null;
  missingFields?: string[];
  suggestions: string[];
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ExtractedEntities {
  items: Array<{ name: string; quantity: number; unit: string }>;
  buyer: string | null;
  supplier: string | null;
  deliveryAddress: string | null;
  timeRange: string | null;
}
