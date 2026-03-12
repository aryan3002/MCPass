import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeToolCall } from "@mcpaas/kernel-runtime";
import { createHandlerFromDefinition } from "@mcpaas/kernel-runtime";
import { getToolDefinitions, upsertToolDefinition } from "@mcpaas/kernel-datastore";
import { connectorFactory } from "@mcpaas/kernel-connectors";
import { getTemplatesForDomain } from "@mcpaas/kernel-registry";
import type { Tenant, ToolHandler, ToolCallResponse, DBToolDefinition, BusinessDomain } from "@mcpaas/kernel-types";
import type { MCPaaSConnector } from "@mcpaas/kernel-connectors";
import {
  searchPropertiesSchema,
  searchPropertiesDescription,
  createSearchPropertiesHandler,
  getPropertyDetailsSchema,
  getPropertyDetailsDescription,
  createGetPropertyDetailsHandler,
  checkAvailabilitySchema,
  checkAvailabilityDescription,
  createCheckAvailabilityHandler,
  comparePropertiesSchema,
  comparePropertiesDescription,
  createComparePropertiesHandler,
  scheduleVisitSchema,
  scheduleVisitDescription,
  createScheduleVisitHandler,
  getNeighborhoodInfoSchema,
  getNeighborhoodInfoDescription,
  createGetNeighborhoodInfoHandler,
} from "@mcpaas/tools-cribliv";

/**
 * Register tools for a tenant on an MCP server instance.
 *
 * Dispatch logic:
 *   - connectorType "cribliv"  → code-defined tools from @mcpaas/tools-cribliv
 *   - all other tenants        → DB-driven tools from tool_definitions table (with auto-generation)
 */
export async function registerTenantTools(server: McpServer, tenant: Tenant): Promise<void> {
  const connectorType = tenant.config?.connectorType;

  // CribLiv path — code-defined rental tools (unchanged, backwards-compatible)
  if (connectorType === "cribliv" || !connectorType) {
    registerCribLivTools(server, tenant.id);
    return;
  }

  // All other connectors (mongodb, shopify, feed, etc.): DB-driven with domain awareness
  const businessDomain: BusinessDomain =
    (tenant.config?.businessDomain as BusinessDomain) ?? inferDomainFromConnector(connectorType);

  // Dynamic path — load tool definitions from DB
  let toolDefs = await getToolDefinitions(tenant.id);

  // Auto-generate connector tools if none exist for this connector type.
  const hasConnectorTypeTools = toolDefs.some((d) => d.handlerType === "connector");
  if (!hasConnectorTypeTools) {
    console.log(`[mcpaas] No connector tools found for "${tenant.slug}". Attempting auto-generation...`);
    try {
      const credentials = {
        ...((tenant.config?.connectorConfig as Record<string, string>) ?? {}),
        businessDomain,
        tenantId: tenant.id,
      };
      const connector = await connectorFactory(connectorType, credentials);
      if (connector) {
        const templates = getTemplatesForDomain(businessDomain, connector.capabilities);
        for (const template of templates) {
          await upsertToolDefinition(tenant.id, {
            name: template.name,
            description: template.description,
            inputSchema: template.inputSchema,
            handlerType: template.handlerType,
            handlerConfig: template.handlerConfig,
            isEnabled: true,
            version: 1,
          });
        }
        console.log(`[mcpaas] Auto-generated ${templates.length} ${businessDomain} tool definitions for tenant: ${tenant.slug}`);
        // Reload from DB
        toolDefs = await getToolDefinitions(tenant.id);
      }
    } catch (err) {
      console.warn(`[mcpaas] Auto-generation failed for tenant "${tenant.slug}":`, err);
    }
  }

  if (toolDefs.length === 0) {
    console.warn(`[mcpaas] Tenant "${tenant.slug}" has no enabled tool definitions in DB`);
    return;
  }

  // Try to instantiate a live connector for connector-type tools
  let connector: MCPaaSConnector | null = null;
  const hasConnectorTools = toolDefs.some((d) => d.handlerType === "connector");

  if (hasConnectorTools) {
    const credentials = {
      ...((tenant.config?.connectorConfig as Record<string, string>) ?? {}),
      businessDomain,
      tenantId: tenant.id,
    };
    try {
      connector = await connectorFactory(connectorType, credentials);
      if (connector) {
        console.log(`[mcpaas] Connector "${connectorType}" loaded for tenant: ${tenant.slug}`);
      }
    } catch (err) {
      console.error(`[mcpaas] Failed to load connector "${connectorType}" for tenant ${tenant.slug}:`, err);
    }
  }

  // Register all tools
  for (const def of toolDefs) {
    let handler: ToolHandler;

    if (def.handlerType === "connector" && connector) {
      // Wire connector-backed tools to the live connector instance
      handler = createConnectorLiveHandler(def, connector);
    } else {
      // Webhook, static, or connector without a loaded connector (falls back to error)
      handler = createHandlerFromDefinition(def);
    }

    const wrappedHandler = wrapWithExecutor(tenant.id, def.name, handler);
    const zodShape = jsonSchemaToZodShape(def.inputSchema);
    server.tool(def.name, def.description, zodShape, wrappedHandler);
  }

  console.log(`[mcpaas] Registered ${toolDefs.length} DB-driven tools for tenant: ${tenant.slug}`);
}

/**
 * Creates a handler that delegates to a live connector instance.
 */
function createConnectorLiveHandler(def: DBToolDefinition, connector: MCPaaSConnector): ToolHandler {
  const method = def.handlerConfig?.method as string | undefined;
  if (!method) {
    return async () => ({
      success: false,
      error: { code: "CONFIG_ERROR", message: `Connector tool "${def.name}" has no method configured` },
      metadata: { latencyMs: 0 },
    });
  }

  return async (input: Record<string, unknown>): Promise<ToolCallResponse> => {
    const start = performance.now();
    try {
      const result = await connector.execute(method, input);
      const latencyMs = Math.round(performance.now() - start);
      return {
        success: true,
        data: result,
        metadata: { latencyMs },
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: "CONNECTOR_ERROR",
          message: err instanceof Error ? err.message : "Connector execution failed",
        },
        metadata: { latencyMs: Math.round(performance.now() - start) },
      };
    }
  };
}

/**
 * Wraps any tool handler with the kernel executor pipeline (policy + telemetry).
 */
function wrapWithExecutor(
  tenantId: string,
  toolName: string,
  handler: ToolHandler,
  agentPlatform: "chatgpt" | "claude" | "gemini" | "browser" | "unknown" = "unknown"
) {
  return async (input: Record<string, unknown>) => {
    const result = await executeToolCall(
      { tenantId, toolName, input, agentPlatform },
      handler
    );

    if (result.success) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
      };
    } else {
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result.error, null, 2) }],
        isError: true,
      };
    }
  };
}

/**
 * Converts a plain JSON Schema object into a Zod shape suitable for server.tool().
 * This is a best-effort conversion; complex schemas fall back to z.unknown().
 */
function jsonSchemaToZodShape(
  schema: Record<string, unknown>
): Record<string, z.ZodType> {
  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
  const required = (schema.required as string[]) ?? [];

  if (!properties) return {};

  const shape: Record<string, z.ZodType> = {};

  for (const [key, prop] of Object.entries(properties)) {
    let zodType = jsonSchemaTypeToZod(prop);
    if (!required.includes(key)) {
      zodType = zodType.optional();
    }
    shape[key] = zodType;
  }

  return shape;
}

function jsonSchemaTypeToZod(prop: Record<string, unknown>): z.ZodType {
  const type = prop.type as string | undefined;
  const description = prop.description as string | undefined;

  let zodType: z.ZodType;

  switch (type) {
    case "string":
      zodType = description ? z.string().describe(description) : z.string();
      if (prop.enum) {
        const values = prop.enum as [string, ...string[]];
        zodType = z.enum(values);
        if (description) zodType = zodType.describe(description);
      }
      break;
    case "number":
    case "integer":
      zodType = description ? z.number().describe(description) : z.number();
      break;
    case "boolean":
      zodType = description ? z.boolean().describe(description) : z.boolean();
      break;
    case "array": {
      const itemType = prop.items ? jsonSchemaTypeToZod(prop.items as Record<string, unknown>) : z.unknown();
      zodType = z.array(itemType);
      if (description) zodType = zodType.describe(description);
      break;
    }
    case "object":
      zodType = z.record(z.unknown());
      if (description) zodType = zodType.describe(description);
      break;
    default:
      zodType = z.unknown();
  }

  return zodType;
}

/**
 * Infer business domain from connector type when not explicitly set.
 */
function inferDomainFromConnector(connectorType: string): BusinessDomain {
  if (["shopify", "woocommerce", "feed"].includes(connectorType)) return "ecommerce";
  return "rental"; // mongodb defaults to rental (overridden by explicit config)
}

/**
 * Register all CribLiv tools (code-defined, backwards-compatible).
 */
function registerCribLivTools(server: McpServer, tenantId: string): void {
  const searchHandler = createSearchPropertiesHandler(tenantId);
  const detailsHandler = createGetPropertyDetailsHandler(tenantId);
  const availabilityHandler = createCheckAvailabilityHandler(tenantId);
  const compareHandler = createComparePropertiesHandler(tenantId);
  const visitHandler = createScheduleVisitHandler(tenantId);
  const neighborhoodHandler = createGetNeighborhoodInfoHandler(tenantId);

  server.tool("search_properties", searchPropertiesDescription, searchPropertiesSchema.shape, wrapWithExecutor(tenantId, "search_properties", searchHandler));
  server.tool("get_property_details", getPropertyDetailsDescription, getPropertyDetailsSchema.shape, wrapWithExecutor(tenantId, "get_property_details", detailsHandler));
  server.tool("check_availability", checkAvailabilityDescription, checkAvailabilitySchema.shape, wrapWithExecutor(tenantId, "check_availability", availabilityHandler));
  server.tool("compare_properties", comparePropertiesDescription, comparePropertiesSchema.shape, wrapWithExecutor(tenantId, "compare_properties", compareHandler));
  server.tool("schedule_visit", scheduleVisitDescription, scheduleVisitSchema.shape, wrapWithExecutor(tenantId, "schedule_visit", visitHandler));
  server.tool("get_neighborhood_info", getNeighborhoodInfoDescription, getNeighborhoodInfoSchema.shape, wrapWithExecutor(tenantId, "get_neighborhood_info", neighborhoodHandler));

  console.log(`[mcpaas] Registered 6 CribLiv tools for tenant: ${tenantId}`);
}
