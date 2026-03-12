import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabase, getCurrentTenantId } from "@/lib/supabase";

// PUT /api/tools/:toolId — update a tool
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { toolId } = await params;
  const body = await request.json();
  const { name, description, handlerType, handlerConfig, inputSchema, isEnabled } = body;

  const supabase = getSupabase();

  // Verify tool belongs to tenant
  const { data: existing } = await supabase
    .from("tool_definitions")
    .select("id, version")
    .eq("id", toolId)
    .eq("tenant_id", tenantId)
    .single();

  if (!existing) return NextResponse.json({ error: "Tool not found" }, { status: 404 });

  // Build update payload — only include provided fields
  const updates: Record<string, unknown> = {};
  if (name !== undefined) {
    const nameRegex = /^[a-z][a-z0-9_]{1,63}$/;
    if (!nameRegex.test(name)) {
      return NextResponse.json(
        { error: "Tool name must be lowercase, start with a letter, use only letters/numbers/underscores, 2-64 chars" },
        { status: 400 }
      );
    }
    updates.name = name;
  }
  if (description !== undefined) updates.description = description;
  if (handlerType !== undefined) updates.handler_type = handlerType;
  if (handlerConfig !== undefined) updates.handler_config = handlerConfig;
  if (inputSchema !== undefined) updates.input_schema = inputSchema;
  if (isEnabled !== undefined) updates.is_enabled = isEnabled;

  // Bump version on any edit
  updates.version = existing.version + 1;

  const { data, error } = await supabase
    .from("tool_definitions")
    .update(updates)
    .eq("id", toolId)
    .eq("tenant_id", tenantId)
    .select("id, name, version")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tool: data });
}

// DELETE /api/tools/:toolId — delete a tool
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { toolId } = await params;
  const supabase = getSupabase();

  // Verify tool belongs to tenant
  const { data: existing } = await supabase
    .from("tool_definitions")
    .select("id")
    .eq("id", toolId)
    .eq("tenant_id", tenantId)
    .single();

  if (!existing) return NextResponse.json({ error: "Tool not found" }, { status: 404 });

  const { error } = await supabase
    .from("tool_definitions")
    .delete()
    .eq("id", toolId)
    .eq("tenant_id", tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
