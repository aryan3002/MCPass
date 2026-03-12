import type { Property, PropertySearchFilters, PublicProperty } from "@mcpaas/kernel-types";
import { getSupabaseClient } from "./client.js";

// Columns to select - explicitly excludes owner_contact (PII)
const PUBLIC_COLUMNS = `
  id, tenant_id, listing_id, title, type, bedrooms, rent_monthly, deposit,
  area_sqft, locality, city, address, amenities, furnishing, available_from,
  is_verified, photos, description, lease_duration, preferred_tenants,
  latitude, longitude, is_active, created_at, updated_at
`;

function mapRow(row: Record<string, unknown>): PublicProperty {
  return {
    id: row.id as string,
    listingId: row.listing_id as string,
    title: row.title as string,
    type: row.type as Property["type"],
    bedrooms: row.bedrooms as number | null,
    rentMonthly: row.rent_monthly as number,
    deposit: row.deposit as number | null,
    areaSqft: row.area_sqft as number | null,
    locality: row.locality as string,
    city: row.city as string,
    address: row.address as string | null,
    amenities: (row.amenities as string[]) ?? [],
    furnishing: row.furnishing as Property["furnishing"],
    availableFrom: row.available_from as string | null,
    isVerified: row.is_verified as boolean,
    photos: (row.photos as string[]) ?? [],
    description: row.description as string | null,
    leaseDuration: row.lease_duration as string | null,
    preferredTenants: row.preferred_tenants as string | null,
    latitude: row.latitude as number | null,
    longitude: row.longitude as number | null,
    isActive: row.is_active as boolean,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    tenantId: undefined as never, // excluded from public type
  } as unknown as PublicProperty;
}

export async function searchProperties(
  tenantId: string,
  filters: PropertySearchFilters
): Promise<PublicProperty[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("properties")
    .select(PUBLIC_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (filters.city) {
    query = query.ilike("city", `%${filters.city}%`);
  }
  if (filters.locality) {
    query = query.ilike("locality", `%${filters.locality}%`);
  }
  if (filters.type) {
    query = query.eq("type", filters.type);
  }
  if (filters.bedrooms) {
    query = query.eq("bedrooms", filters.bedrooms);
  }
  if (filters.budgetMin) {
    query = query.gte("rent_monthly", filters.budgetMin);
  }
  if (filters.budgetMax) {
    query = query.lte("rent_monthly", filters.budgetMax);
  }
  if (filters.furnishing) {
    query = query.eq("furnishing", filters.furnishing);
  }
  if (filters.isVerified !== undefined) {
    query = query.eq("is_verified", filters.isVerified);
  }
  if (filters.amenities && filters.amenities.length > 0) {
    query = query.contains("amenities", filters.amenities);
  }

  const limit = filters.limit ?? 10;
  const offset = filters.offset ?? 0;
  query = query.order("rent_monthly", { ascending: true }).range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Property search failed: ${error.message}`);
  }

  return (data ?? []).map(mapRow);
}

export async function getPropertyById(
  tenantId: string,
  propertyId: string
): Promise<PublicProperty | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("properties")
    .select(PUBLIC_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", propertyId)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;
  return mapRow(data);
}

export async function getPropertyByListingId(
  tenantId: string,
  listingId: string
): Promise<PublicProperty | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("properties")
    .select(PUBLIC_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("listing_id", listingId)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;
  return mapRow(data);
}

export async function getPropertiesByIds(
  tenantId: string,
  propertyIds: string[]
): Promise<PublicProperty[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("properties")
    .select(PUBLIC_COLUMNS)
    .eq("tenant_id", tenantId)
    .in("id", propertyIds)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Batch property fetch failed: ${error.message}`);
  }

  return (data ?? []).map(mapRow);
}
