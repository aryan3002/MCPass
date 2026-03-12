"use client";

import { useState, useEffect } from "react";

interface ToolDef {
  id: string;
  name: string;
  description: string;
  handler_type: string;
  input_schema: Record<string, unknown>;
  is_enabled: boolean;
}

interface TestResult {
  initResponse: unknown;
  toolResponse: {
    result?: {
      content?: Array<{ type: string; text: string }>;
      isError?: boolean;
    };
    error?: { message: string };
  };
}

export default function PlaygroundPage() {
  const [tools, setTools] = useState<ToolDef[]>([]);
  const [selectedTool, setSelectedTool] = useState<string>("");
  const [apiKey, setApiKey] = useState("");
  const [params, setParams] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingTools, setLoadingTools] = useState(true);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    fetch("/api/tools")
      .then((r) => r.json())
      .then((data) => {
        setTools(data.tools ?? []);
        setLoadingTools(false);
      })
      .catch(() => setLoadingTools(false));
  }, []);

  const currentTool = tools.find((t) => t.name === selectedTool);
  const inputProps = (currentTool?.input_schema?.properties ?? {}) as Record<
    string,
    { type?: string; description?: string }
  >;
  const requiredParams = ((currentTool?.input_schema?.required ?? []) as string[]);

  function selectTool(name: string) {
    setSelectedTool(name);
    setParams({});
    setResult(null);
    setError(null);
  }

  function buildInput(): Record<string, unknown> {
    const input: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (!value) continue;
      const schema = inputProps[key];
      if (schema?.type === "number") {
        input[key] = Number(value);
      } else if (schema?.type === "boolean") {
        input[key] = value === "true";
      } else if (schema?.type === "array") {
        try { input[key] = JSON.parse(value); } catch { input[key] = value.split(",").map((s) => s.trim()); }
      } else {
        input[key] = value;
      }
    }
    return input;
  }

  async function runTest() {
    if (!selectedTool || !apiKey) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/tools/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName: selectedTool,
          input: buildInput(),
          apiKey,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setLoading(false);
    }
  }

  // Parse the tool response content
  function getFormattedResult(): { text: string; isError: boolean } | null {
    if (!result?.toolResponse?.result?.content) return null;
    const content = result.toolResponse.result.content;
    const textParts = content.filter((c) => c.type === "text").map((c) => c.text);
    return {
      text: textParts.join("\n"),
      isError: result.toolResponse.result.isError ?? false,
    };
  }

  const formatted = getFormattedResult();

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Playground</h2>
        <p className="text-gray-400 text-sm mt-1">
          Test your MCP tools directly. Enter your API key and invoke any tool to see the response.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Tool selection + params */}
        <div className="space-y-4">
          {/* API Key */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <label className="block text-sm text-gray-400 mb-2">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="mcp_..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
            />
            <p className="text-xs text-gray-600 mt-1">Your API key is not stored. It's used only for this test request.</p>
          </div>

          {/* Tool picker */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <label className="block text-sm text-gray-400 mb-2">Select tool</label>
            {loadingTools ? (
              <div className="text-sm text-gray-500">Loading tools...</div>
            ) : tools.length === 0 ? (
              <div className="text-sm text-gray-500">
                No tools found. <a href="/tools" className="text-blue-400 hover:text-blue-300">Create one first</a>.
              </div>
            ) : (
              <div className="space-y-2">
                {tools.filter((t) => t.is_enabled).map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => selectTool(tool.name)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedTool === tool.name
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-gray-700 bg-gray-800 hover:border-gray-600"
                    }`}
                  >
                    <span className="font-mono text-sm text-blue-400">{tool.name}</span>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{tool.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Parameters */}
          {currentTool && Object.keys(inputProps).length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <label className="block text-sm text-gray-400 mb-3">Parameters</label>
              <div className="space-y-3">
                {Object.entries(inputProps).map(([key, schema]) => (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-1">
                      <label className="text-sm font-mono text-gray-300">{key}</label>
                      <span className="text-xs text-gray-600">{schema.type}</span>
                      {requiredParams.includes(key) && (
                        <span className="text-xs text-red-400">required</span>
                      )}
                    </div>
                    {schema.description && (
                      <p className="text-xs text-gray-600 mb-1">{schema.description}</p>
                    )}
                    <input
                      type="text"
                      value={params[key] ?? ""}
                      onChange={(e) => setParams({ ...params, [key]: e.target.value })}
                      placeholder={schema.type === "array" ? '["a","b"] or a,b,c' : `Enter ${key}`}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 text-sm font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Run button */}
          <button
            onClick={runTest}
            disabled={loading || !selectedTool || !apiKey}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium py-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Running...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Run Tool
              </>
            )}
          </button>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {/* Result display */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 min-h-[400px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">Response</h3>
              {result && (
                <button
                  onClick={() => setShowRaw(!showRaw)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showRaw ? "Formatted" : "Raw JSON"}
                </button>
              )}
            </div>

            {!result && !error && (
              <div className="flex items-center justify-center h-64 text-gray-600">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">Select a tool and run it to see results</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-sm text-red-400 font-medium mb-1">Error</p>
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {result && !showRaw && formatted && (
              <div className={`rounded-lg p-4 ${formatted.isError ? "bg-red-500/10 border border-red-500/20" : "bg-gray-800/50"}`}>
                {formatted.isError && <p className="text-xs text-red-400 mb-2 font-medium">Tool returned an error</p>}
                <pre className="text-sm text-gray-200 whitespace-pre-wrap font-mono overflow-auto max-h-[500px]">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(formatted.text), null, 2);
                    } catch {
                      return formatted.text;
                    }
                  })()}
                </pre>
              </div>
            )}

            {result && showRaw && (
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap overflow-auto max-h-[600px] bg-gray-800/50 rounded-lg p-4">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>

          {/* MCP Request preview */}
          {selectedTool && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">MCP Request</h3>
              <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap overflow-auto bg-gray-800/50 rounded-lg p-3">
{`POST /api/{slug}/mcp
Authorization: Bearer ***

{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "${selectedTool}",
    "arguments": ${JSON.stringify(buildInput(), null, 4).split("\n").map((l, i) => i === 0 ? l : "    " + l).join("\n")}
  }
}`}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
