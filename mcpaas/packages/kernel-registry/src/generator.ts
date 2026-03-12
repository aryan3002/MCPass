import type { DBToolDefinition, BusinessDomain } from "@mcpaas/kernel-types";
import type { MCPaaSConnector } from "@mcpaas/kernel-connectors";
import { upsertToolDefinition } from "@mcpaas/kernel-datastore";
import { getTemplatesForCapabilities, getTemplatesForDomain } from "./templates.js";

/**
 * Tool Definition Generator
 *
 * Given a tenant ID and a connector, generates and saves tool definitions
 * to the `tool_definitions` table. Merchants can then review and edit
 * these in the dashboard before deploying.
 */
export async function generateToolDefinitions(
  tenantId: string,
  connector: MCPaaSConnector,
  domain: BusinessDomain = "ecommerce"
): Promise<DBToolDefinition[]> {
  const templates = getTemplatesForDomain(domain, connector.capabilities);
  const results: DBToolDefinition[] = [];

  for (const template of templates) {
    const saved = await upsertToolDefinition(tenantId, {
      name: template.name,
      description: template.description,
      inputSchema: template.inputSchema,
      handlerType: template.handlerType,
      handlerConfig: template.handlerConfig,
      isEnabled: true,
      version: 1,
    });

    if (saved) results.push(saved);
  }

  console.log(
    `[kernel-registry] Generated ${results.length} tool definitions for tenant: ${tenantId}`
  );

  return results;
}

/**
 * Preview what tools would be generated for a given connector type,
 * without saving to the database.
 */
export function previewToolDefinitions(
  capabilities: MCPaaSConnector["capabilities"]
): ReturnType<typeof getTemplatesForCapabilities> {
  return getTemplatesForCapabilities(capabilities);
}
