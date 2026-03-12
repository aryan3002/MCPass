import type { DBToolDefinition, ToolHandler, ToolCallResponse } from "@mcpaas/kernel-types";

/**
 * Creates a ToolHandler from a DBToolDefinition.
 *
 * Three handler types:
 *   "webhook"   - POST to merchant's URL, return the JSON response
 *   "connector" - delegate to connector.execute(method, params)  [stub for now]
 *   "static"    - return handlerConfig.data as the response
 */
export function createHandlerFromDefinition(def: DBToolDefinition): ToolHandler {
  switch (def.handlerType) {
    case "webhook":
      return createWebhookHandler(def);
    case "static":
      return createStaticHandler(def);
    case "connector":
      return createConnectorHandler(def);
    default:
      return async () => ({
        success: false,
        error: { code: "UNSUPPORTED_HANDLER", message: `Unknown handler type: ${(def as DBToolDefinition).handlerType}` },
        metadata: { latencyMs: 0 },
      });
  }
}

function createWebhookHandler(def: DBToolDefinition): ToolHandler {
  const url = def.handlerConfig?.url as string | undefined;
  if (!url) {
    return async () => ({
      success: false,
      error: { code: "CONFIG_ERROR", message: `Webhook tool "${def.name}" has no URL configured` },
      metadata: { latencyMs: 0 },
    });
  }

  const method = (def.handlerConfig?.method as string | undefined) ?? "POST";
  const extraHeaders = (def.handlerConfig?.headers as Record<string, string> | undefined) ?? {};

  return async (input: Record<string, unknown>): Promise<ToolCallResponse> => {
    const start = performance.now();
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...extraHeaders },
        ...(method !== "GET" ? { body: JSON.stringify(input) } : {}),
      });

      const latencyMs = Math.round(performance.now() - start);

      if (!response.ok) {
        return {
          success: false,
          error: { code: "WEBHOOK_ERROR", message: `Webhook returned ${response.status}` },
          metadata: { latencyMs },
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
        metadata: { latencyMs },
      };
    } catch (err) {
      return {
        success: false,
        error: { code: "WEBHOOK_FETCH_ERROR", message: err instanceof Error ? err.message : "Fetch failed" },
        metadata: { latencyMs: Math.round(performance.now() - start) },
      };
    }
  };
}

function createStaticHandler(def: DBToolDefinition): ToolHandler {
  const data = def.handlerConfig?.data ?? null;
  return async (): Promise<ToolCallResponse> => ({
    success: true,
    data,
    metadata: { latencyMs: 0 },
  });
}

function createConnectorHandler(def: DBToolDefinition): ToolHandler {
  // Connector-backed handlers are resolved at registration time with a live
  // connector instance. This fallback fires if no connector was provided.
  return async () => ({
    success: false,
    error: {
      code: "NO_CONNECTOR",
      message: `Tool "${def.name}" requires a connector but none is loaded for this tenant`,
    },
    metadata: { latencyMs: 0 },
  });
}
