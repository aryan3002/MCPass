"use client";

import { useState } from "react";

interface IntegrationClientProps {
  tenantSlug: string;
  tenantId: string;
  mcpEndpoint: string;
  webmcpScript: string;
  ucpProfile: string;
}

export default function IntegrationClient({
  tenantSlug,
  tenantId,
  mcpEndpoint,
  webmcpScript,
  ucpProfile,
}: IntegrationClientProps) {
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  async function handleRegenerate() {
    if (!confirmRegen) {
      setConfirmRegen(true);
      return;
    }
    setRegenerating(true);
    try {
      const res = await fetch("/api/tenant/regenerate-key", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewApiKey(data.apiKey);
      setConfirmRegen(false);
    } catch {
      setConfirmRegen(false);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Integration</h2>
      <p className="text-gray-400 mb-8 text-sm">
        Everything you need to connect your MCP endpoint to any AI agent.
      </p>

      <div className="space-y-6">
        {/* MCP Endpoint */}
        <Section
          title="Backend MCP Endpoint"
          badge="Claude · ChatGPT · Any MCP Client"
          badgeColor="blue"
          description="Your server-side MCP endpoint. Works with Claude Desktop, ChatGPT (via Actions), and any MCP-compatible agent."
        >
          <CodeBlock label="Endpoint URL" value={mcpEndpoint} />
          <CodeBlock
            label="Authorization header"
            value="Authorization: Bearer <your-api-key>"
          />
          <div className="bg-gray-800/50 rounded-lg p-4 text-sm">
            <p className="text-gray-400 mb-2 font-medium">Claude Desktop config example:</p>
            <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">{`{
  "mcpServers": {
    "${tenantSlug}": {
      "url": "${mcpEndpoint}",
      "headers": {
        "Authorization": "Bearer <your-api-key>"
      }
    }
  }
}`}</pre>
          </div>
        </Section>

        {/* WebMCP Script */}
        <Section
          title="WebMCP Script Tag"
          badge="Chrome Browser Agents"
          badgeColor="purple"
          description="Add this script to your website to make your tools available to Chrome browser agents (Chrome 146+ with WebMCP enabled)."
        >
          <CodeBlock
            label="Script tag (add to your website's <head>)"
            value={`<script src="${webmcpScript}" defer></script>`}
          />
        </Section>

        {/* UCP Profile */}
        <Section
          title="UCP Discovery Profile"
          badge="Google AI Mode · Gemini"
          badgeColor="green"
          description="Your Universal Checkout Profile URL. Submit this to Google to appear in Search AI Mode and Gemini."
        >
          <CodeBlock label="UCP Profile URL" value={ucpProfile} />
        </Section>

        {/* API Key management */}
        <Section
          title="API Key"
          badge="Security"
          badgeColor="amber"
          description="Your API key was shown once when you created your account. To regenerate it, use the button below."
        >
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
            <p className="text-sm text-amber-300 mb-1">Your API key is not stored in plain text.</p>
            <p className="text-xs text-gray-400">
              If you&apos;ve lost your API key, regenerate one below. Your previous key will be invalidated.
            </p>
          </div>

          {newApiKey && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <p className="text-sm text-green-400 font-medium mb-2">New API Key (copy now, won&apos;t be shown again):</p>
              <CodeBlock label="" value={newApiKey} />
            </div>
          )}

          {confirmRegen && !newApiKey && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-sm text-red-400 mb-2">
                This will invalidate your current API key. All active MCP integrations will stop working until updated.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="text-sm bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  {regenerating ? "Regenerating..." : "Yes, regenerate"}
                </button>
                <button
                  onClick={() => setConfirmRegen(false)}
                  className="text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!confirmRegen && !newApiKey && (
            <button
              onClick={handleRegenerate}
              className="text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white px-4 py-2 rounded-lg transition-colors"
            >
              Regenerate API key
            </button>
          )}
        </Section>

        {/* Quick test */}
        <Section
          title="Quick Test"
          badge="curl"
          badgeColor="gray"
          description="Test your MCP endpoint from the command line."
        >
          <div className="bg-gray-800/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-2">Step 1: Initialize session</p>
            <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap overflow-x-auto mb-3">{`curl -X POST ${mcpEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "Authorization: Bearer <your-api-key>" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl-test","version":"1.0"}}}'`}</pre>
            <p className="text-xs text-gray-500 mb-2">Step 2: List tools (use the mcp-session-id from the response header above)</p>
            <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap overflow-x-auto">{`curl -X POST ${mcpEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "Authorization: Bearer <your-api-key>" \\
  -H "mcp-session-id: <session-id-from-step-1>" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'`}</pre>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  badge,
  badgeColor,
  description,
  children,
}: {
  title: string;
  badge: string;
  badgeColor: "blue" | "purple" | "green" | "amber" | "gray";
  description: string;
  children: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    gray: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex items-center gap-3 mb-2">
        <h3 className="font-semibold text-white">{title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${colors[badgeColor]}`}>{badge}</span>
      </div>
      <p className="text-sm text-gray-400 mb-4">{description}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function CodeBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      {label && <p className="text-xs text-gray-500 mb-1">{label}</p>}
      <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5">
        <span className="flex-1 text-sm text-gray-200 truncate font-mono">{value}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors shrink-0"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
