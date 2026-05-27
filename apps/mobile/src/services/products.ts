import { apiRequest } from './api';

export interface ProductPriceDto {
  id: string;
  name: string;
  category: string;
  unit: string;
  referencePrice: number;
  supplierPrice?: number;
  stock?: number;
}

export function listProducts(search?: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest<ProductPriceDto[]>(`/api/products${query}`);
}
