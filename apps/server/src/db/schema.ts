import {
  pgTable, uuid, varchar, text, integer, decimal,
  timestamp, jsonb, pgEnum, index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const userRoleEnum = pgEnum('user_role', ['buyer', 'supplier', 'admin']);
export const orderStatusEnum = pgEnum('order_status', [
  'pending', 'confirmed', 'sorting', 'sorted', 'delivering', 'completed', 'cancelled',
]);
export const creatorRoleEnum = pgEnum('creator_role', ['buyer', 'supplier']);

export const markets = pgTable('markets', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  marketId: uuid('market_id').references(() => markets.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  unit: varchar('unit', { length: 20 }).notNull(),
  referencePrice: decimal('reference_price', { precision: 10, scale: 2 }).notNull(),
  marketId: uuid('market_id').references(() => markets.id).notNull(),
  embedding: text('embedding'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  marketIdx: index('products_market_idx').on(table.marketId),
  categoryIdx: index('products_category_idx').on(table.category),
}));

export const supplierProducts = pgTable('supplier_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  supplierId: uuid('supplier_id').references(() => users.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  stock: integer('stock').notNull().default(0),
}, (table) => ({
  supplierIdx: index('sp_supplier_idx').on(table.supplierId),
  productIdx: index('sp_product_idx').on(table.productId),
}));

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNo: varchar('order_no', { length: 50 }).notNull().unique(),
  creatorId: uuid('creator_id').references(() => users.id).notNull(),
  creatorRole: creatorRoleEnum('creator_role').notNull(),
  buyerId: uuid('buyer_id').references(() => users.id).notNull(),
  buyerName: varchar('buyer_name', { length: 255 }).notNull(),
  supplierId: uuid('supplier_id').references(() => users.id).notNull(),
  supplierName: varchar('supplier_name', { length: 255 }).notNull(),
  totalPrice: decimal('total_price', { precision: 12, scale: 2 }).notNull(),
  status: orderStatusEnum('status').notNull().default('pending'),
  deliveryAddress: text('delivery_address'),
  deliveryTime: text('delivery_time'),
  remark: text('remark'),
  marketId: uuid('market_id').references(() => markets.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  buyerIdx: index('orders_buyer_idx').on(table.buyerId),
  supplierIdx: index('orders_supplier_idx').on(table.supplierId),
  statusIdx: index('orders_status_idx').on(table.status),
  createdAtIdx: index('orders_created_at_idx').on(table.createdAt),
}));

export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull(),
  unit: varchar('unit', { length: 20 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  messages: jsonb('messages').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  market: one(markets, { fields: [users.marketId], references: [markets.id] }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  market: one(markets, { fields: [products.marketId], references: [markets.id] }),
  supplierProducts: many(supplierProducts),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));
