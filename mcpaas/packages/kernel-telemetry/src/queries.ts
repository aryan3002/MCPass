import type { TelemetryStats } from "@mcpaas/kernel-types";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  supabase = createClient(url, key);
  return supabase;
}

export async function getTelemetryStats(tenantId: string): Promise<TelemetryStats> {
  const client = getClient();
  const today = new Date().toISOString().split("T")[0];

  // Total calls
  const { count: totalCalls } = await client
    .from("tool_calls")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  // Calls today
  const { count: callsToday } = await client
    .from("tool_calls")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", `${today}T00:00:00Z`);

  // Latency and error stats
  const { data: latencyData } = await client
    .from("tool_calls")
    .select("latency_ms, status")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1000);

  const latencies = (latencyData ?? []).map((d) => d.latency_ms as number).sort((a, b) => a - b);
  const avgLatencyMs = latencies.length > 0
    ? Math.round(latencies.reduce((s, l) => s + l, 0) / latencies.length)
    : 0;
  const p95LatencyMs = latencies.length > 0
    ? latencies[Math.floor(latencies.length * 0.95)] ?? 0
    : 0;

  const errors = (latencyData ?? []).filter((d) => d.status === "error").length;
  const errorRate = latencyData && latencyData.length > 0 ? errors / latencyData.length : 0;

  // Top tools
  const { data: toolData } = await client
    .from("tool_calls")
    .select("tool_name")
    .eq("tenant_id", tenantId);

  const toolCounts: Record<string, number> = {};
  for (const row of toolData ?? []) {
    const name = row.tool_name as string;
    toolCounts[name] = (toolCounts[name] ?? 0) + 1;
  }
  const topTools = Object.entries(toolCounts)
    .map(([toolName, count]) => ({ toolName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalCalls: totalCalls ?? 0,
    callsToday: callsToday ?? 0,
    avgLatencyMs,
    p95LatencyMs,
    errorRate,
    topTools,
  };
}

export interface RecentToolCall {
  id: string;
  toolName: string;
  inputParams: Record<string, unknown>;
  status: string;
  latencyMs: number;
  agentPlatform: string;
  resultCount: number | null;
  createdAt: string;
}

export async function getRecentToolCalls(
  tenantId: string,
  limit = 50
): Promise<RecentToolCall[]> {
  const client = getClient();
  const { data, error } = await client
    .from("tool_calls")
    .select("id, tool_name, input_params, status, latency_ms, agent_platform, result_count, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch recent tool calls: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    toolName: row.tool_name,
    inputParams: row.input_params,
    status: row.status,
    latencyMs: row.latency_ms,
    agentPlatform: row.agent_platform,
    resultCount: row.result_count,
    createdAt: row.created_at,
  }));
}
