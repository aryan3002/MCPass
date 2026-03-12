export interface Product {
  id: string;
  tenantId: string;
  externalId: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  inventory: number | null;
  images: string[];
  categories: string[];
  attributes: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductSearchFilters {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
  offset?: number;
}
