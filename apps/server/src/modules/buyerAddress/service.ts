import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { buyerAddresses } from '../../db/schema.js';
import type { BuyerAddressInput, NormalizedBuyerAddressInput } from './types.js';

type ExistingAddress = { id: string; isDefault: boolean };
type AddressForPromotion = ExistingAddress & { createdAt: Date };

export function normalizeAddressInput(input: BuyerAddressInput): NormalizedBuyerAddressInput {
  const contactName = input.contactName?.trim();
  const contactPhone = input.contactPhone?.trim();
  const address = input.address?.trim();

  if (!contactName) throw new Error('联系人不能为空');
  if (!contactPhone) throw new Error('联系电话不能为空');
  if (!address) throw new Error('配送地址不能为空');

  return {
    contactName,
    contactPhone,
    address,
    isDefault: input.isDefault === true,
  };
}

export function chooseDefaultAddressAfterCreate(
  existingAddresses: ExistingAddress[],
  requestedDefault: boolean,
): boolean {
  return existingAddresses.length === 0 || requestedDefault;
}

export function chooseDefaultAfterDelete(addresses: AddressForPromotion[]): string | null {
  const newest = [...addresses].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
  return newest?.id || null;
}

async function unsetDefaultAddresses(userId: string): Promise<void> {
  await db
    .update(buyerAddresses)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(buyerAddresses.userId, userId));
}

export async function listBuyerAddresses(userId: string) {
  return db
    .select()
    .from(buyerAddresses)
    .where(eq(buyerAddresses.userId, userId))
    .orderBy(desc(buyerAddresses.isDefault), desc(buyerAddresses.createdAt));
}

export async function getDefaultBuyerAddress(userId: string) {
  const [address] = await db
    .select()
    .from(buyerAddresses)
    .where(and(eq(buyerAddresses.userId, userId), eq(buyerAddresses.isDefault, true)))
    .limit(1);

  return address || null;
}

export async function createBuyerAddress(userId: string, input: BuyerAddressInput) {
  const normalized = normalizeAddressInput(input);
  const existing = await listBuyerAddresses(userId);
  const isDefault = chooseDefaultAddressAfterCreate(existing, normalized.isDefault);

  if (isDefault) {
    await unsetDefaultAddresses(userId);
  }

  const [created] = await db
    .insert(buyerAddresses)
    .values({ userId, ...normalized, isDefault })
    .returning();

  return created;
}

export async function updateBuyerAddress(userId: string, id: string, input: BuyerAddressInput) {
  const normalized = normalizeAddressInput(input);

  if (normalized.isDefault) {
    await unsetDefaultAddresses(userId);
  }

  const [updated] = await db
    .update(buyerAddresses)
    .set({ ...normalized, updatedAt: new Date() })
    .where(and(eq(buyerAddresses.id, id), eq(buyerAddresses.userId, userId)))
    .returning();

  if (!updated) throw new Error('地址不存在');
  return updated;
}

export async function setDefaultBuyerAddress(userId: string, id: string) {
  const [address] = await db
    .select()
    .from(buyerAddresses)
    .where(and(eq(buyerAddresses.id, id), eq(buyerAddresses.userId, userId)))
    .limit(1);

  if (!address) throw new Error('地址不存在');

  await unsetDefaultAddresses(userId);
  const [updated] = await db
    .update(buyerAddresses)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(and(eq(buyerAddresses.id, id), eq(buyerAddresses.userId, userId)))
    .returning();

  return updated;
}

export async function deleteBuyerAddress(userId: string, id: string) {
  const [deleted] = await db
    .delete(buyerAddresses)
    .where(and(eq(buyerAddresses.id, id), eq(buyerAddresses.userId, userId)))
    .returning();

  if (!deleted) throw new Error('地址不存在');

  if (deleted.isDefault) {
    const remaining = await listBuyerAddresses(userId);
    const nextDefaultId = chooseDefaultAfterDelete(remaining);
    if (nextDefaultId) {
      await setDefaultBuyerAddress(userId, nextDefaultId);
    }
  }

  return deleted;
}
