import { getRecentCalls } from "@/lib/queries";
import { getCurrentTenantId } from "@/lib/supabase";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) redirect("/onboarding");

  const calls = await getRecentCalls(tenantId, 50);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Recent Tool Calls</h2>
      <p className="text-gray-400 mb-6">Last 50 tool invocations across all agent platforms.</p>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left p-4">Tool</th>
              <th className="text-left p-4">Parameters</th>
              <th className="text-center p-4">Status</th>
              <th className="text-right p-4">Latency</th>
              <th className="text-center p-4">Platform</th>
              <th className="text-right p-4">Time</th>
            </tr>
          </thead>
          <tbody>
            {calls.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No tool calls recorded yet. Start using the MCP server to see data here.
                </td>
              </tr>
            ) : (
              calls.map((call) => (
                <tr key={call.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="p-4 font-mono text-blue-400">{call.toolName}</td>
                  <td className="p-4 max-w-xs">
                    <span className="text-gray-400 text-xs font-mono truncate block">
                      {formatParams(call.inputParams)}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <StatusBadge status={call.status} />
                  </td>
                  <td className="p-4 text-right font-mono">
                    {call.latencyMs}ms
                  </td>
                  <td className="p-4 text-center">
                    <PlatformBadge platform={call.agentPlatform} />
                  </td>
                  <td className="p-4 text-right text-gray-400 text-xs">
                    {formatTime(call.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: "bg-green-500/10 text-green-400 border-green-500/20",
    error: "bg-red-500/10 text-red-400 border-red-500/20",
    policy_blocked: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full border ${colors[status] ?? "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
      {status}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const colors: Record<string, string> = {
    chatgpt: "text-green-400",
    claude: "text-orange-400",
    gemini: "text-blue-400",
    browser: "text-purple-400",
    unknown: "text-gray-500",
  };
  return <span className={`text-xs font-mono ${colors[platform] ?? "text-gray-500"}`}>{platform}</span>;
}

function formatParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params).slice(0, 3);
  const parts = entries.map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`);
  if (Object.keys(params).length > 3) parts.push("...");
  return parts.join(", ");
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
