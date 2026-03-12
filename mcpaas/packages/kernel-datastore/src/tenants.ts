import type { Tenant } from "@mcpaas/kernel-types";
import { getSupabaseClient } from "./client.js";

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    apiKeyHash: data.api_key_hash,
    plan: data.plan,
    config: data.config,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

export async function getTenantByUserId(userId: string): Promise<Tenant | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    apiKeyHash: data.api_key_hash,
    plan: data.plan,
    config: data.config,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    apiKeyHash: data.api_key_hash,
    plan: data.plan,
    config: data.config,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}
