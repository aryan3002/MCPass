import type { Tenant } from "@mcpaas/kernel-types";
import { getToolDefinitions } from "@mcpaas/kernel-datastore";
import {
  searchPropertiesDescription,
  getPropertyDetailsDescription,
  checkAvailabilityDescription,
  comparePropertiesDescription,
  scheduleVisitDescription,
  getNeighborhoodInfoDescription,
} from "@mcpaas/tools-cribliv";

const CRIBLIV_TOOLS = [
  { name: "search_properties", description: searchPropertiesDescription },
  { name: "get_property_details", description: getPropertyDetailsDescription },
  { name: "check_availability", description: checkAvailabilityDescription },
  { name: "compare_properties", description: comparePropertiesDescription },
  { name: "schedule_visit", description: scheduleVisitDescription },
  { name: "get_neighborhood_info", description: getNeighborhoodInfoDescription },
];

/**
 * Generate a tenant-specific WebMCP injection script.
 * The script registers all tenant tools via navigator.modelContext.registerTool()
 * for Chrome browser agent support.
 *
 * Endpoint: GET /api/:tenantSlug/webmcp.js
 */
export async function generateWebMCPScript(tenant: Tenant, mcpServerUrl: string): Promise<string> {
  const connectorType = tenant.config?.connectorType;
  const isCribliv = !connectorType || connectorType === "cribliv";

  let toolRegistrations: string;

  if (isCribliv) {
    toolRegistrations = CRIBLIV_TOOLS.map((tool) =>
      buildToolRegistration(tool.name, tool.description, mcpServerUrl, tenant.slug)
    ).join("\n");
  } else {
    const toolDefs = await getToolDefinitions(tenant.id);
    const enabledTools = toolDefs.filter((t) => t.isEnabled);

    if (enabledTools.length === 0) {
      toolRegistrations = "// No tools configured for this tenant";
    } else {
      toolRegistrations = enabledTools.map((tool) =>
        buildToolRegistration(tool.name, tool.description, mcpServerUrl, tenant.slug)
      ).join("\n");
    }
  }

  return `
// MCPaaS WebMCP Script — ${tenant.name} (${tenant.slug})
// Auto-generated. Do not edit manually.
// Version: ${new Date().toISOString().split("T")[0]}

(function() {
  if (typeof navigator === "undefined" || !navigator.modelContext) {
    // WebMCP not available in this browser
    return;
  }

  const MCP_ENDPOINT = "${mcpServerUrl}/api/${tenant.slug}/mcp";

  ${toolRegistrations}

  console.log("[MCPaaS] WebMCP tools registered for ${tenant.name}");
})();
`.trim();
}

function buildToolRegistration(
  name: string,
  description: string,
  mcpServerUrl: string,
  slug: string
): string {
  const escapedDesc = description.replace(/`/g, "\\`").replace(/\\/g, "\\\\");
  return `
  try {
    navigator.modelContext.registerTool({
      name: ${JSON.stringify(name)},
      description: \`${escapedDesc}\`,
      endpoint: MCP_ENDPOINT,
      auth: { type: "bearer" }
    });
  } catch(e) { /* ignore individual tool registration failures */ }`;
}

/**
 * Generate a UCP (Universal Checkout Profile) discovery document.
 * Published at GET /api/:tenantSlug/ucp
 *
 * Format follows the emerging UCP spec for Google Search AI Mode + Gemini.
 */
export async function generateUCPProfile(tenant: Tenant, mcpServerUrl: string): Promise<object> {
  const connectorType = tenant.config?.connectorType;
  const isCribliv = !connectorType || connectorType === "cribliv";

  let tools: { name: string; description: string }[];

  if (isCribliv) {
    tools = CRIBLIV_TOOLS;
  } else {
    const toolDefs = await getToolDefinitions(tenant.id);
    tools = toolDefs
      .filter((t) => t.isEnabled)
      .map((t) => ({ name: t.name, description: t.description }));
  }

  return {
    "@context": "https://schema.org/",
    "@type": "MerchantProfile",
    name: tenant.name,
    identifier: tenant.slug,
    mcpEndpoint: `${mcpServerUrl}/api/${tenant.slug}/mcp`,
    webmcpScript: `${mcpServerUrl}/api/${tenant.slug}/webmcp.js`,
    capabilities: tools.map((tool) => ({
      "@type": "Capability",
      name: tool.name,
      description: tool.description,
    })),
    authentication: {
      type: "Bearer",
      description: "Include your API key as: Authorization: Bearer <api-key>",
    },
    provider: {
      "@type": "Organization",
      name: "MCPaaS",
      url: "https://mcpaas.dev",
    },
    generatedAt: new Date().toISOString(),
  };
}
