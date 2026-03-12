import { getDashboardStats, getToolStats, getRecentCalls, getTenantTools } from "@/lib/queries";
import { getCurrentTenant, getCurrentTenantId } from "@/lib/supabase";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const tenant = await getCurrentTenant();
  const tenantId = await getCurrentTenantId();

  if (!tenantId || !tenant) {
    redirect("/onboarding");
  }

  const [stats, toolStats, recentCalls, dbTools] = await Promise.all([
    getDashboardStats(tenantId),
    getToolStats(tenantId),
    getRecentCalls(tenantId, 5),
    getTenantTools(tenantId),
  ]);

  const config = (tenant.config as { connectorType?: string; maxToolCallsPerDay?: number }) ?? {};
  const isCribliv = !config.connectorType || config.connectorType === "cribliv";
  const totalTools = isCribliv ? 6 : dbTools.length;
  const mcpServerUrl = process.env.MCP_SERVER_URL ?? "https://mcp.mcpaas.dev";
  const mcpEndpoint = `${mcpServerUrl}/api/${tenant.slug}/mcp`;

  // Quick start checklist
  const checklistItems = [
    { label: "Create account", done: true, href: null },
    { label: "Set up connector", done: !!config.connectorType, href: "/connectors" },
    { label: "Configure tools", done: totalTools > 0, href: "/tools" },
    { label: "Test with Playground", done: stats.totalCalls > 0, href: "/playground" },
    { label: "Connect an AI agent", done: stats.totalCalls > 0, href: "/integration" },
  ];
  const completedSteps = checklistItems.filter((c) => c.done).length;
  const allDone = completedSteps === checklistItems.length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">Welcome back, {tenant.name}</h2>
          <p className="text-gray-400 text-sm mt-1">
            {tenant.slug} · <span className="capitalize text-blue-400">{tenant.plan}</span> ·{" "}
            <span className="text-gray-500 font-mono text-xs">{mcpEndpoint}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-green-400">Live</span>
        </div>
      </div>

      {/* Quick Start Checklist (only show if not all done) */}
      {!allDone && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-white">Getting Started</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {completedSteps}/{checklistItems.length} steps completed
              </p>
            </div>
            {/* Progress bar */}
            <div className="w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${(completedSteps / checklistItems.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            {checklistItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    item.done
                      ? "bg-green-500/20 border border-green-500/40"
                      : "bg-gray-800 border border-gray-700"
                  }`}
                >
                  {item.done && (
                    <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                {item.href && !item.done ? (
                  <a href={item.href} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    {item.label}
                  </a>
                ) : (
                  <span className={`text-sm ${item.done ? "text-gray-500 line-through" : "text-gray-300"}`}>
                    {item.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Calls" value={stats.totalCalls.toLocaleString()} icon="calls" />
        <StatCard label="Today" value={stats.callsToday.toLocaleString()} icon="today" />
        <StatCard
          label="Error Rate"
          value={`${stats.errorRate}%`}
          icon="error"
          color={stats.errorRate > 5 ? "red" : "green"}
        />
        <StatCard label="Avg Latency" value={`${stats.avgLatencyMs}ms`} icon="latency" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2/3: Tool Performance + Recent calls  */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tool Performance */}
          <div className="bg-gray-900 rounded-xl border border-gray-800">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="font-semibold text-white">Tool Performance</h3>
              <a href="/tools" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View all tools
              </a>
            </div>
            <div className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs">
                    <th className="text-left p-4 font-medium">Tool</th>
                    <th className="text-right p-4 font-medium">Calls</th>
                    <th className="text-right p-4 font-medium">Latency</th>
                    <th className="text-right p-4 font-medium">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {toolStats.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-gray-600 text-sm">
                        No calls yet. <a href="/playground" className="text-blue-400 hover:text-blue-300">Test a tool</a> to get started.
                      </td>
                    </tr>
                  ) : (
                    toolStats.slice(0, 6).map((tool) => (
                      <tr key={tool.name} className="border-t border-gray-800/50 hover:bg-gray-800/30">
                        <td className="p-4 font-mono text-blue-400 text-xs">{tool.name}</td>
                        <td className="p-4 text-right text-gray-300">{tool.calls}</td>
                        <td className="p-4 text-right text-gray-400">{tool.avgLatency}ms</td>
                        <td className={`p-4 text-right ${tool.errorRate > 5 ? "text-red-400" : "text-green-400"}`}>
                          {tool.errorRate}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Calls */}
          <div className="bg-gray-900 rounded-xl border border-gray-800">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="font-semibold text-white">Recent Activity</h3>
              <a href="/calls" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View all calls
              </a>
            </div>
            {recentCalls.length === 0 ? (
              <div className="p-6 text-center text-gray-600 text-sm">
                No activity yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-800/50">
                {recentCalls.map((call) => (
                  <div key={call.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-800/30">
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full ${call.status === "success" ? "bg-green-500" : "bg-red-500"}`} />
                      <span className="font-mono text-sm text-blue-400">{call.toolName}</span>
                      <span className="text-xs text-gray-600">{call.agentPlatform}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="font-mono">{call.latencyMs}ms</span>
                      <span>{formatTimeAgo(call.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1/3: Quick links + info */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h3 className="font-semibold text-white mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <QuickLink href="/playground" label="Test a tool" desc="Open Playground" />
              <QuickLink href="/tools" label="Create a tool" desc="Tool Builder" />
              <QuickLink href="/integration" label="Connect agents" desc="Integration Guide" />
              <QuickLink href="/settings" label="Manage account" desc="Settings" />
            </div>
          </div>

          {/* Endpoint info */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h3 className="font-semibold text-white mb-3">Your MCP Endpoint</h3>
            <div className="bg-gray-800 rounded-lg px-3 py-2.5 mb-3">
              <code className="text-xs font-mono text-gray-300 break-all">{mcpEndpoint}</code>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-gray-400">
                <span>Protocol</span>
                <span className="text-gray-300">Streamable HTTP</span>
              </div>
              <div className="flex items-center justify-between text-gray-400">
                <span>Tools</span>
                <span className="text-gray-300">{totalTools} active</span>
              </div>
              <div className="flex items-center justify-between text-gray-400">
                <span>Daily quota</span>
                <span className="text-gray-300">{config.maxToolCallsPerDay?.toLocaleString() ?? "1,000"}/day</span>
              </div>
              <div className="flex items-center justify-between text-gray-400">
                <span>P95 latency</span>
                <span className="text-gray-300">{stats.p95LatencyMs}ms</span>
              </div>
            </div>
          </div>

          {/* Visits */}
          {stats.visitRequests > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold text-white mb-1">Visit Requests</h3>
              <p className="text-3xl font-bold text-amber-400">{stats.visitRequests}</p>
              <p className="text-xs text-gray-500 mt-1">Total scheduled visits from AI agents</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color = "default",
}: {
  label: string;
  value: string;
  icon: string;
  color?: "default" | "red" | "green";
}) {
  const iconMap: Record<string, React.ReactNode> = {
    calls: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
      </svg>
    ),
    today: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    error: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
    latency: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  };

  const colorClasses = {
    default: "text-white",
    red: "text-red-400",
    green: "text-green-400",
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-gray-500">{iconMap[icon]}</span>
        <p className="text-sm text-gray-400">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
    </div>
  );
}

function QuickLink({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <a
      href={href}
      className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 transition-colors group"
    >
      <div>
        <span className="text-sm text-gray-200 group-hover:text-white">{label}</span>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </a>
  );
}

function formatTimeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
