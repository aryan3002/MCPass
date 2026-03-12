import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentTenant, getCurrentTenantId, getSupabase } from "@/lib/supabase";

/**
 * POST /api/connectors/setup
 *
 * Simple endpoint that saves connector config to tenant.
 * The MCP server will auto-generate tool_definitions on next initialization.
 */
export async function POST(request: NextRequest) {
  const tenant = await getCurrentTenant();
  const tenantId = await getCurrentTenantId();
  if (!tenant || !tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { connectorType, config } = body as {
    connectorType: string;
    config: Record<string, unknown>;
  };

  if (!connectorType) {
    return NextResponse.json({ error: "connectorType is required" }, { status: 400 });
  }

  const supabase = getSupabase();

  try {
    // Step 1: Save connector config to tenant
    const existingConfig = (tenant.config ?? {}) as Record<string, unknown>;
    const updatedConfig = {
      ...existingConfig,
      connectorType,
      connectorConfig: config,
    };

    const { error: updateError } = await supabase
      .from("tenants")
      .update({ config: updatedConfig })
      .eq("id", tenantId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      connectorType,
      message: `Connector "${connectorType}" configured. Reload your MCP server for tools to be generated.`,
    });
  } catch (err) {
    console.error("[connectors/setup] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Setup failed" },
      { status: 500 }
    );
  }
}
