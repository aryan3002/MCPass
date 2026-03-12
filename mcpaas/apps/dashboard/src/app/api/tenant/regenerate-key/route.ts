import { NextResponse } from "next/server";
import { getSupabase, getCurrentTenantId } from "@/lib/supabase";
import { createHash, randomBytes } from "crypto";

// POST /api/tenant/regenerate-key — generate new API key, invalidate old one
export async function POST() {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawApiKey = `mcp_${randomBytes(32).toString("hex")}`;
  const apiKeyHash = createHash("sha256").update(rawApiKey).digest("hex");

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("tenants")
    .update({ api_key_hash: apiKeyHash })
    .eq("id", tenantId)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  return NextResponse.json({ apiKey: rawApiKey });
}
