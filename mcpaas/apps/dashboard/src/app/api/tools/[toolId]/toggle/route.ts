import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabase, getCurrentTenantId } from "@/lib/supabase";

// POST /api/tools/:toolId/toggle — toggle tool enabled/disabled
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { toolId } = await params;
  const supabase = getSupabase();

  // Get current state
  const { data: tool } = await supabase
    .from("tool_definitions")
    .select("id, is_enabled")
    .eq("id", toolId)
    .eq("tenant_id", tenantId)
    .single();

  if (!tool) return NextResponse.json({ error: "Tool not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("tool_definitions")
    .update({ is_enabled: !tool.is_enabled })
    .eq("id", toolId)
    .eq("tenant_id", tenantId)
    .select("id, is_enabled")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tool: data });
}
