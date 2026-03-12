import type { Product, ProductSearchFilters } from "@mcpaas/kernel-types";
import { getSupabaseClient } from "./client.js";

function mapRow(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    externalId: row.external_id as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    price: Number(row.price),
    currency: row.currency as string,
    inventory: row.inventory as number | null,
    images: (row.images as string[]) ?? [],
    categories: (row.categories as string[]) ?? [],
    attributes: (row.attributes as Record<string, unknown>) ?? {},
    isActive: row.is_active as boolean,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export async function searchProducts(
  tenantId: string,
  filters: ProductSearchFilters
): Promise<Product[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("products")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (filters.query) {
    query = query.ilike("title", `%${filters.query}%`);
  }
  if (filters.category) {
    query = query.contains("categories", [filters.category]);
  }
  if (filters.minPrice !== undefined) {
    query = query.gte("price", filters.minPrice);
  }
  if (filters.maxPrice !== undefined) {
    query = query.lte("price", filters.maxPrice);
  }

  const limit = filters.limit ?? 10;
  const offset = filters.offset ?? 0;
  query = query.order("price", { ascending: true }).range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Product search failed: ${error.message}`);
  }

  return (data ?? []).map(mapRow);
}

export async function getProductById(
  tenantId: string,
  id: string
): Promise<Product | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;
  return mapRow(data);
}

export async function getProductByExternalId(
  tenantId: string,
  externalId: string
): Promise<Product | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("external_id", externalId)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;
  return mapRow(data);
}

export async function upsertProducts(
  tenantId: string,
  rows: Array<{
    external_id: string;
    title: string;
    description?: string | null;
    price: number;
    currency?: string;
    inventory?: number | null;
    images?: string[];
    categories?: string[];
    attributes?: Record<string, unknown>;
    is_active?: boolean;
  }>
): Promise<void> {
  const supabase = getSupabaseClient();

  const dbRows = rows.map((r) => ({
    tenant_id: tenantId,
    external_id: r.external_id,
    title: r.title,
    description: r.description ?? null,
    price: r.price,
    currency: r.currency ?? "INR",
    inventory: r.inventory ?? null,
    images: r.images ?? [],
    categories: r.categories ?? [],
    attributes: r.attributes ?? {},
    is_active: r.is_active ?? true,
  }));

  // Upsert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < dbRows.length; i += batchSize) {
    const batch = dbRows.slice(i, i + batchSize);
    const { error } = await supabase
      .from("products")
      .upsert(batch, { onConflict: "tenant_id,external_id" });

    if (error) {
      throw new Error(`Product upsert failed (batch ${Math.floor(i / batchSize) + 1}): ${error.message}`);
    }
  }
}
