import type { ToolCallEvent } from "@mcpaas/kernel-types";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials for telemetry");
  supabase = createClient(url, key);
  return supabase;
}

export async function recordToolCall(event: ToolCallEvent): Promise<void> {
  const client = getClient();

  // Truncate output to prevent storing huge payloads
  let truncatedOutput = event.output;
  if (truncatedOutput) {
    const outputStr = JSON.stringify(truncatedOutput);
    if (outputStr.length > 10000) {
      truncatedOutput = { _truncated: true, preview: outputStr.slice(0, 500) };
    }
  }

  const { error } = await client.from("tool_calls").insert({
    tenant_id: event.tenantId,
    tool_name: event.toolName,
    input_params: event.inputParams,
    output: truncatedOutput ?? null,
    result_count: event.resultCount ?? null,
    status: event.status,
    error_message: event.errorMessage ?? null,
    latency_ms: event.latencyMs,
    agent_platform: event.agentPlatform,
    session_id: event.sessionId ?? null,
    user_ip: event.userIp ?? null,
  });

  if (error) {
    // Log but don't throw - telemetry should never break tool execution
    console.error("[telemetry] Failed to record tool call:", error.message);
  }
}
