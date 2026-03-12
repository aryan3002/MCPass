import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabase, getCurrentTenantId } from "@/lib/supabase";

// GET /api/tools — list all tools for current tenant
export async function GET() {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("tool_definitions")
    .select("id, name, description, handler_type, handler_config, is_enabled, version, input_schema")
    .eq("tenant_id", tenantId)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tools: data });
}

// POST /api/tools — create a new tool
export async function POST(request: NextRequest) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, description, handlerType, handlerConfig, inputSchema } = body as {
    name: string;
    description: string;
    handlerType: "webhook" | "static" | "connector";
    handlerConfig: Record<string, unknown> | null;
    inputSchema: Record<string, unknown>;
  };

  if (!name || !description || !handlerType) {
    return NextResponse.json({ error: "name, description, and handlerType are required" }, { status: 400 });
  }

  // Validate tool name: lowercase, underscores, no spaces
  const nameRegex = /^[a-z][a-z0-9_]{1,63}$/;
  if (!nameRegex.test(name)) {
    return NextResponse.json(
      { error: "Tool name must be lowercase, start with a letter, use only letters/numbers/underscores, 2-64 chars" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  // Check for duplicate name within tenant
  const { data: existing } = await supabase
    .from("tool_definitions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name", name)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "A tool with this name already exists" }, { status: 409 });
  }

  const schema = inputSchema ?? { type: "object", properties: {}, required: [] };

  const { data, error } = await supabase
    .from("tool_definitions")
    .insert({
      tenant_id: tenantId,
      name,
      description,
      handler_type: handlerType,
      handler_config: handlerConfig ?? null,
      is_enabled: true,
      version: 1,
      input_schema: schema,
    })
    .select("id, name")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tool: data }, { status: 201 });
}
