import { getCurrentTenant, getCurrentTenantId } from "@/lib/supabase";
import { redirect } from "next/navigation";
import SettingsClient from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const tenant = await getCurrentTenant();
  const tenantId = await getCurrentTenantId();

  if (!tenantId || !tenant) {
    redirect("/onboarding");
  }

  // Get user email for display
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = user?.email ?? "Unknown";

  return (
    <SettingsClient
      tenant={{
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        config: (tenant.config as Record<string, unknown>) ?? {},
        created_at: tenant.created_at,
      }}
      userEmail={userEmail}
    />
  );
}
