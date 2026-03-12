import type { ToolCallRequest } from "@mcpaas/kernel-types";
import { getTenantById, getSupabaseClient } from "@mcpaas/kernel-datastore";

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * Policy engine — evaluates whether a tool call is allowed.
 *
 * Rules evaluated (in order):
 *   1. Daily quota: tenant.config.maxToolCallsPerDay vs actual count today
 *   2. Surface check: agentPlatform must be in enabledSurfaces (future)
 *   3. Per-tool rate limit: optional per-minute limit per tool (future)
 *
 * On DB/evaluation errors: fails open (allows the call) so a DB outage
 * doesn't break all tool calls for all tenants.
 */
export async function evaluatePolicy(
  request: ToolCallRequest
): Promise<PolicyDecision> {
  try {
    const tenant = await getTenantById(request.tenantId);
    if (!tenant) {
      return { allowed: false, reason: "Tenant not found" };
    }

    const config = tenant.config;
    const maxCallsPerDay = config.maxToolCallsPerDay ?? 1000;

    // ── Rule 1: Daily quota ──────────────────────────────────────────────────
    if (maxCallsPerDay > 0) {
      const today = new Date().toISOString().split("T")[0];
      const supabase = getSupabaseClient();
      const { count } = await supabase
        .from("tool_calls")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", request.tenantId)
        .gte("created_at", `${today}T00:00:00Z`)
        .in("status", ["success", "error"]);

      if (count !== null && count >= maxCallsPerDay) {
        return {
          allowed: false,
          reason: `Daily quota of ${maxCallsPerDay} tool calls exceeded. Upgrade your plan for higher limits.`,
        };
      }
    }

    // ── Rule 2: Surface check (future) ───────────────────────────────────────
    // const enabledSurfaces = config.enabledSurfaces ?? ["mcp"];
    // surface validation will go here

    return { allowed: true };
  } catch (err) {
    console.warn("[kernel-policy] Evaluation error (failing open):", err);
    return { allowed: true };
  }
}
