"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

interface LiveCall {
  id: string;
  tool_name: string;
  input_params: Record<string, unknown>;
  status: string;
  latency_ms: number;
  agent_platform: string;
  result_count: number | null;
  created_at: string;
}

export default function LivePage() {
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY for live feed");
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const channel = supabase
      .channel("tool_calls_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tool_calls" },
        (payload) => {
          const newCall = payload.new as LiveCall;
          setCalls((prev) => [newCall, ...prev].slice(0, 100));
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-2xl font-bold">Live Feed</h2>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
          <span className="text-sm text-gray-400">{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>

      <p className="text-gray-400 mb-6">
        Real-time tool call feed. Calls appear here as agents invoke MCP tools.
      </p>

      <div className="space-y-2">
        {calls.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
            <p className="text-gray-500 mb-2">Waiting for tool calls...</p>
            <p className="text-gray-600 text-sm">
              Send a query through ChatGPT or Claude to see live tool invocations here.
            </p>
          </div>
        ) : (
          calls.map((call) => (
            <div
              key={call.id}
              className="bg-gray-900 rounded-lg border border-gray-800 p-4 animate-in fade-in slide-in-from-top-1 duration-300"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-blue-400 font-semibold">{call.tool_name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      call.status === "success"
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}
                  >
                    {call.status}
                  </span>
                  <span className="text-xs text-gray-500">{call.agent_platform}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="font-mono">{call.latency_ms}ms</span>
                  {call.result_count !== null && (
                    <span>{call.result_count} results</span>
                  )}
                  <span>{new Date(call.created_at).toLocaleTimeString()}</span>
                </div>
              </div>
              <pre className="text-xs font-mono text-gray-500 overflow-hidden text-ellipsis">
                {JSON.stringify(call.input_params, null, 0).slice(0, 200)}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
