import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabase, getCurrentTenantId } from "@/lib/supabase";

// PUT /api/tenant — update tenant settings
export async function PUT(request: NextRequest) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, config } = body as {
    name?: string;
    config?: {
      maxToolCallsPerDay?: number;
      enabledSurfaces?: string[];
    };
  };

  const supabase = getSupabase();

  // Get current tenant for merging config
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, config")
    .eq("id", tenantId)
    .single();

  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (name !== undefined && name.trim()) updates.name = name.trim();
  if (config) {
    const currentConfig = (tenant.config as Record<string, unknown>) ?? {};
    updates.config = { ...currentConfig, ...config };
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tenants")
    .update(updates)
    .eq("id", tenantId)
    .select("id, name, slug, plan, config")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tenant: data });
}

// DELETE /api/tenant — delete tenant and all data
export async function DELETE() {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();

  // CASCADE should handle related rows, but let's be explicit
  const { error } = await supabase
    .from("tenants")
    .delete()
    .eq("id", tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
