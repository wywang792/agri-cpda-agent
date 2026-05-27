export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  referencePrice: number;
  marketId: string;
}

export interface SupplierProduct {
  supplierId: string;
  productId: string;
  price: number;
  stock: number;
}

export interface PriceInfo {
  product: Product;
  supplierPrice?: number;
  referencePrice: number;
  priceChange?: number;
}
