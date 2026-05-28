export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'sorting'
  | 'sorted'
  | 'delivering'
  | 'completed'
  | 'cancelled';

export type CreatorRole = 'buyer' | 'supplier';

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: string;
  orderNo: string;
  creatorId: string;
  creatorRole: CreatorRole;
  buyerId: string;
  buyerName: string;
  supplierId: string;
  supplierName: string;
  items: OrderItem[];
  totalPrice: number;
  status: OrderStatus;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  deliveryAddress: string;
  deliveryTimeText?: string;
  deliveryStartAt?: Date;
  deliveryEndAt?: Date;
  remark?: string;
  marketId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderRequest {
  buyerId: string;
  supplierId: string;
  items: {
    productId: string;
    quantity: number;
  }[];
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  deliveryAddress: string;
  deliveryTimeText?: string;
  deliveryStartAt?: Date;
  deliveryEndAt?: Date;
  remark?: string;
}
