import { getSupabase } from "./supabase";

export interface DashboardStats {
  totalCalls: number;
  callsToday: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
  visitRequests: number;
}

export async function getDashboardStats(tenantId: string): Promise<DashboardStats> {
  const supabase = getSupabase();
  const today = new Date().toISOString().split("T")[0];

  const [totalRes, todayRes, latencyRes, visitsRes] = await Promise.all([
    supabase
      .from("tool_calls")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("tool_calls")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", `${today}T00:00:00Z`),
    supabase
      .from("tool_calls")
      .select("latency_ms, status")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("visit_requests")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ]);

  const latencies = (latencyRes.data ?? [])
    .map((d) => d.latency_ms as number)
    .sort((a, b) => a - b);
  const errors = (latencyRes.data ?? []).filter((d) => d.status === "error").length;

  return {
    totalCalls: totalRes.count ?? 0,
    callsToday: todayRes.count ?? 0,
    avgLatencyMs:
      latencies.length > 0
        ? Math.round(latencies.reduce((s, l) => s + l, 0) / latencies.length)
        : 0,
    p95LatencyMs: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] ?? 0 : 0,
    errorRate: latencies.length > 0 ? Math.round((errors / latencies.length) * 100) : 0,
    visitRequests: visitsRes.count ?? 0,
  };
}

export interface RecentCall {
  id: string;
  toolName: string;
  inputParams: Record<string, unknown>;
  status: string;
  latencyMs: number;
  agentPlatform: string;
  resultCount: number | null;
  createdAt: string;
}

export async function getRecentCalls(tenantId: string, limit = 50): Promise<RecentCall[]> {
  const supabase = getSupabase();

  const { data } = await supabase
    .from("tool_calls")
    .select("id, tool_name, input_params, status, latency_ms, agent_platform, result_count, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

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

export interface ToolStat {
  name: string;
  calls: number;
  avgLatency: number;
  errorRate: number;
}

export async function getToolStats(tenantId: string): Promise<ToolStat[]> {
  const supabase = getSupabase();

  const { data } = await supabase
    .from("tool_calls")
    .select("tool_name, latency_ms, status")
    .eq("tenant_id", tenantId);

  const stats: Record<string, { calls: number; totalLatency: number; errors: number }> = {};
  for (const row of data ?? []) {
    const name = row.tool_name as string;
    if (!stats[name]) stats[name] = { calls: 0, totalLatency: 0, errors: 0 };
    stats[name].calls++;
    stats[name].totalLatency += row.latency_ms as number;
    if (row.status === "error") stats[name].errors++;
  }

  return Object.entries(stats)
    .map(([name, s]) => ({
      name,
      calls: s.calls,
      avgLatency: Math.round(s.totalLatency / s.calls),
      errorRate: Math.round((s.errors / s.calls) * 100),
    }))
    .sort((a, b) => b.calls - a.calls);
}

export interface TenantToolDef {
  id: string;
  name: string;
  description: string;
  handlerType: string;
  handlerConfig: Record<string, unknown> | null;
  isEnabled: boolean;
  version: number;
  inputSchema: Record<string, unknown>;
}

export async function getTenantTools(tenantId: string): Promise<TenantToolDef[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("tool_definitions")
    .select("id, name, description, handler_type, handler_config, is_enabled, version, input_schema")
    .eq("tenant_id", tenantId)
    .order("name");

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    handlerType: row.handler_type,
    handlerConfig: row.handler_config,
    isEnabled: row.is_enabled,
    version: row.version,
    inputSchema: row.input_schema,
  }));
}
