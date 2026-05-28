import { apiRequest } from './api';

export interface BuyerAddressDto {
  id: string;
  contactName: string;
  contactPhone: string;
  address: string;
  isDefault: boolean;
}

export interface BuyerAddressInput {
  contactName: string;
  contactPhone: string;
  address: string;
  isDefault?: boolean;
}

export function listBuyerAddresses() {
  return apiRequest<BuyerAddressDto[]>('/api/buyer-addresses');
}

export function createBuyerAddress(input: BuyerAddressInput) {
  return apiRequest<BuyerAddressDto>('/api/buyer-addresses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateBuyerAddress(id: string, input: BuyerAddressInput) {
  return apiRequest<BuyerAddressDto>(`/api/buyer-addresses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteBuyerAddress(id: string) {
  return apiRequest<BuyerAddressDto>(`/api/buyer-addresses/${id}`, {
    method: 'DELETE',
  });
}

export function setDefaultBuyerAddress(id: string) {
  return apiRequest<BuyerAddressDto>(`/api/buyer-addresses/${id}/default`, {
    method: 'POST',
  });
}
