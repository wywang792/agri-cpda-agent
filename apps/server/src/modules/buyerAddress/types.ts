export interface BuyerAddressInput {
  contactName?: string;
  contactPhone?: string;
  address?: string;
  isDefault?: boolean;
}

export interface NormalizedBuyerAddressInput {
  contactName: string;
  contactPhone: string;
  address: string;
  isDefault: boolean;
}
