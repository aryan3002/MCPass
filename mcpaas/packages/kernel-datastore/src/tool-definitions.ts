import type { DBToolDefinition } from "@mcpaas/kernel-types";
import { getSupabaseClient } from "./client.js";

/**
 * Fetch all enabled tool definitions for a tenant.
 * Returns an empty array if the tenant has none (e.g. cribliv uses code-defined tools).
 */
export async function getToolDefinitions(tenantId: string): Promise<DBToolDefinition[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tool_definitions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_enabled", true)
    .order("name");

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    inputSchema: row.input_schema as Record<string, unknown>,
    handlerType: row.handler_type as "connector" | "webhook" | "static",
    handlerConfig: row.handler_config as Record<string, unknown> | null,
    isEnabled: row.is_enabled,
    version: row.version,
    createdAt: new Date(row.created_at),
  }));
}

/**
 * Upsert a tool definition for a tenant (create or update by name).
 */
export async function upsertToolDefinition(
  tenantId: string,
  def: Omit<DBToolDefinition, "id" | "tenantId" | "createdAt">
): Promise<DBToolDefinition | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tool_definitions")
    .upsert(
      {
        tenant_id: tenantId,
        name: def.name,
        description: def.description,
        input_schema: def.inputSchema,
        handler_type: def.handlerType,
        handler_config: def.handlerConfig,
        is_enabled: def.isEnabled,
        version: def.version,
      },
      { onConflict: "tenant_id,name" }
    )
    .select()
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    tenantId: data.tenant_id,
    name: data.name,
    description: data.description,
    inputSchema: data.input_schema as Record<string, unknown>,
    handlerType: data.handler_type as "connector" | "webhook" | "static",
    handlerConfig: data.handler_config as Record<string, unknown> | null,
    isEnabled: data.is_enabled,
    version: data.version,
    createdAt: new Date(data.created_at),
  };
}
