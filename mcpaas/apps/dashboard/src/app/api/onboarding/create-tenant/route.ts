import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  // Verify session
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, slug, connectorType, businessDomain } = body as {
    name: string;
    slug: string;
    connectorType: string;
    businessDomain?: string;
  };

  if (!name || !slug || !connectorType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Use admin client for DB operations
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check slug uniqueness
  const { data: existing } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
  }

  // Generate API key (plain) + hash (stored)
  const rawApiKey = `mcp_${randomBytes(32).toString("hex")}`;
  const apiKeyHash = createHash("sha256").update(rawApiKey).digest("hex");

  // Create tenant
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .insert({
      name,
      slug,
      api_key_hash: apiKeyHash,
      plan: "free",
      user_id: user.id,
      config: {
        maxToolCallsPerDay: 1000,
        enabledSurfaces: ["mcp"],
        connectorType,
        businessDomain: businessDomain ?? (
          ["shopify", "feed", "woocommerce"].includes(connectorType) ? "ecommerce" : "rental"
        ),
      },
    })
    .select("id")
    .single();

  if (tenantError || !tenant) {
    console.error("[create-tenant] Error:", tenantError);
    return NextResponse.json({ error: "Failed to create tenant" }, { status: 500 });
  }

  return NextResponse.json({
    tenantId: tenant.id,
    slug,
    apiKey: rawApiKey,  // Only returned once — never stored plain
  });
}
