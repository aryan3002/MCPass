export type PropertyType = "apartment" | "pg" | "villa" | "studio";
export type FurnishingType = "Furnished" | "Semi-Furnished" | "Unfurnished";

export interface Property {
  id: string;
  tenantId: string;
  listingId: string;
  title: string;
  type: PropertyType;
  bedrooms: number | null;
  rentMonthly: number;
  deposit: number | null;
  areaSqft: number | null;
  locality: string;
  city: string;
  address: string | null;
  amenities: string[];
  furnishing: FurnishingType | null;
  availableFrom: string | null;
  isVerified: boolean;
  photos: string[];
  description: string | null;
  leaseDuration: string | null;
  preferredTenants: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Property as returned to agents - no PII (owner_contact excluded) */
export type PublicProperty = Omit<Property, "tenantId">;

export interface PropertySearchFilters {
  city?: string;
  locality?: string;
  type?: PropertyType;
  bedrooms?: number;
  budgetMin?: number;
  budgetMax?: number;
  amenities?: string[];
  furnishing?: FurnishingType;
  isVerified?: boolean;
  limit?: number;
  offset?: number;
}

export interface VisitRequest {
  id: string;
  tenantId: string;
  propertyId: string;
  visitorName: string;
  visitorPhone: string;
  visitorEmail: string | null;
  preferredDate: string;
  preferredTime: "morning" | "afternoon" | "evening";
  status: "pending" | "confirmed" | "cancelled";
  notes: string | null;
  sessionId: string | null;
  createdAt: Date;
}
