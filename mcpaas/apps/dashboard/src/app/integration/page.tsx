import { getCurrentTenant, getCurrentTenantId } from "@/lib/supabase";
import { redirect } from "next/navigation";
import IntegrationClient from "./integration-client";

export const dynamic = "force-dynamic";

export default async function IntegrationPage() {
  const tenant = await getCurrentTenant();
  const tenantId = await getCurrentTenantId();

  if (!tenantId || !tenant) {
    redirect("/onboarding");
  }

  const mcpServerUrl = process.env.MCP_SERVER_URL ?? "https://mcp.mcpaas.dev";
  const mcpEndpoint = `${mcpServerUrl}/api/${tenant.slug}/mcp`;
  const webmcpScript = `${mcpServerUrl}/api/${tenant.slug}/webmcp.js`;
  const ucpProfile = `${mcpServerUrl}/api/${tenant.slug}/ucp`;

  return (
    <IntegrationClient
      tenantSlug={tenant.slug}
      tenantId={tenantId}
      mcpEndpoint={mcpEndpoint}
      webmcpScript={webmcpScript}
      ucpProfile={ucpProfile}
    />
  );
}
