import type { AgentIntent, Order } from '@agent-xfd/shared';

export interface OrderDraftItem {
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
}

export interface OrderDraft {
  buyerId?: string;
  buyerName?: string;
  buyerPhone?: string;
  supplierId?: string;
  supplierName?: string;
  deliveryAddress?: string;
  deliveryTime?: string;
  remark?: string;
  items: OrderDraftItem[];
  totalPrice?: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    intent?: AgentIntent | null;
    orderDraft?: OrderDraft | null;
    orderId?: string;
    order?: Order | null;
    error?: string;
  };
}

export interface CurrentConversationResponse {
  id: string;
  userId: string;
  messages: ConversationMessage[];
  orderDraft: OrderDraft | null;
  createdAt: Date;
  updatedAt: Date;
}
