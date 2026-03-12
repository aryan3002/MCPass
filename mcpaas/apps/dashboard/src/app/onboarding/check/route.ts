import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

/**
 * After auth callback: check if this user already has a tenant.
 * - Has tenant → redirect to dashboard
 * - No tenant  → redirect to onboarding wizard
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/";

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/login`);
  }

  // Check if this user already has a tenant
  const admin = createSupabaseAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tenant) {
    // Existing merchant → go to dashboard
    return NextResponse.redirect(`${origin}${next}`);
  }

  // New merchant → go to onboarding wizard
  return NextResponse.redirect(`${origin}/onboarding`);
}
