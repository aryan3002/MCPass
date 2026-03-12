import type { ToolCallRequest, ToolCallResponse, ToolHandler } from "@mcpaas/kernel-types";
import { evaluatePolicy } from "@mcpaas/kernel-policy";
import { recordToolCall } from "@mcpaas/kernel-telemetry";

/**
 * The MCPaaS Kernel Executor Pipeline.
 *
 * Every tool call flows through this pipeline:
 *   1. VALIDATE - Zod schema check (done at MCP SDK level)
 *   2. POLICY  - Rate limits, guardrails (stubbed in POC)
 *   3. EXECUTE - Call the tool handler
 *   4. RECORD  - Write telemetry event
 *
 * Each step is independently testable and timed.
 */
export async function executeToolCall(
  request: ToolCallRequest,
  handler: ToolHandler
): Promise<ToolCallResponse> {
  const startTime = performance.now();

  try {
    // Step 2: POLICY
    const policyResult = await evaluatePolicy(request);
    if (!policyResult.allowed) {
      const latencyMs = Math.round(performance.now() - startTime);
      const response: ToolCallResponse = {
        success: false,
        error: { code: "POLICY_BLOCKED", message: policyResult.reason ?? "Request blocked by policy" },
        metadata: { latencyMs },
      };

      // Record blocked call
      await recordToolCall({
        tenantId: request.tenantId,
        toolName: request.toolName,
        inputParams: request.input,
        status: "policy_blocked",
        errorMessage: policyResult.reason,
        latencyMs,
        agentPlatform: request.agentPlatform,
        sessionId: request.sessionId,
      });

      return response;
    }

    // Step 3: EXECUTE
    const result = await handler(request.input);
    const latencyMs = Math.round(performance.now() - startTime);

    // Update metadata with actual latency
    result.metadata.latencyMs = latencyMs;

    // Step 4: RECORD
    await recordToolCall({
      tenantId: request.tenantId,
      toolName: request.toolName,
      inputParams: request.input,
      output: result.data,
      resultCount: result.metadata.resultCount,
      status: result.success ? "success" : "error",
      errorMessage: result.error?.message,
      latencyMs,
      agentPlatform: request.agentPlatform,
      sessionId: request.sessionId,
    });

    return result;
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startTime);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    // Record failed call
    await recordToolCall({
      tenantId: request.tenantId,
      toolName: request.toolName,
      inputParams: request.input,
      status: "error",
      errorMessage,
      latencyMs,
      agentPlatform: request.agentPlatform,
      sessionId: request.sessionId,
    });

    return {
      success: false,
      error: { code: "EXECUTION_ERROR", message: errorMessage },
      metadata: { latencyMs },
    };
  }
}
