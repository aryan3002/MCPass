import { getCurrentTenant, getCurrentTenantId } from "@/lib/supabase";
import { redirect } from "next/navigation";
import ConnectorsClient from "./connectors-client";

export const dynamic = "force-dynamic";

export default async function ConnectorsPage() {
  const tenant = await getCurrentTenant();
  const tenantId = await getCurrentTenantId();

  if (!tenantId || !tenant) {
    redirect("/onboarding");
  }

  const config = (tenant.config as { connectorType?: string }) ?? {};

  return (
    <ConnectorsClient
      currentConnector={config.connectorType ?? "manual"}
      tenantSlug={tenant.slug}
      tenantId={tenantId}
    />
  );
}
