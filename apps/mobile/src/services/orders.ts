import { apiRequest } from './api';

export interface OrderItemDto {
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: string;
  subtotal: string;
}

export interface OrderDto {
  id: string;
  orderNo: string;
  buyerName: string;
  supplierName: string;
  totalPrice: string;
  status: string;
  deliveryContactName?: string | null;
  deliveryContactPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryTimeText?: string | null;
  deliveryStartAt?: string | null;
  deliveryEndAt?: string | null;
  createdAt: string;
  items: OrderItemDto[];
}

export function listOrders(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest<OrderDto[]>(`/api/orders${query}`);
}
