import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase admin client (bypasses RLS).
 * Use this for data queries in Server Components — scope all queries by tenantId.
 */
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * Get the current tenant ID from the authenticated session.
 * Returns null if not logged in or no tenant set up yet.
 * Uses updated_at so the most recently active tenant is picked (not just the newest).
 */
export async function getCurrentTenantId(): Promise<string | null> {
  const { createSupabaseServerClient } = await import("./supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = getSupabase();
  const { data } = await admin
    .from("tenants")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

/**
 * Get the current tenant (full object) from the authenticated session.
 * If the user has multiple tenants, picks the most recently active (by updated_at).
 */
export async function getCurrentTenant() {
  const { createSupabaseServerClient } = await import("./supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = getSupabase();
  const { data } = await admin
    .from("tenants")
    .select("id, name, slug, plan, config, created_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}
