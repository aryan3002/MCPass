"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type ConnectorType = "cribliv" | "shopify" | "woocommerce" | "feed" | "custom-api" | "manual" | "mongodb";

const CONNECTOR_OPTIONS: { id: ConnectorType; label: string; desc: string; badge?: string }[] = [
  { id: "shopify", label: "Shopify", desc: "Connect via OAuth — auto-imports your catalog", badge: "Most popular" },
  { id: "woocommerce", label: "WooCommerce", desc: "API key connection to your WooCommerce store" },
  { id: "mongodb", label: "MongoDB", desc: "Connect your MongoDB Atlas or self-hosted cluster — for rental, real estate, or custom data models" },
  { id: "feed", label: "Product Feed", desc: "Upload a CSV, JSON, or Google Shopping XML feed" },
  { id: "custom-api", label: "Custom REST API", desc: "Map your existing API endpoints to MCP tools" },
  { id: "manual", label: "Manual (define tools)", desc: "Write tool definitions yourself — any business type" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — Business info
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);

  // Step 2 — Connector
  const [connectorType, setConnectorType] = useState<ConnectorType>("manual");
  const [mongoDomain, setMongoDomain] = useState<"rental" | "ecommerce">("rental");

  // Step 3 — Review + create
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  function deriveSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }

  async function checkSlug(value: string) {
    if (!value) { setSlugAvailable(null); return; }
    const res = await fetch(`/api/onboarding/check-slug?slug=${encodeURIComponent(value)}`);
    const json = await res.json();
    setSlugAvailable(json.available);
  }

  async function createTenant() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch("/api/onboarding/create-tenant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: businessName,
          slug,
          connectorType,
          businessDomain: connectorType === "mongodb"
            ? mongoDomain
            : ["shopify", "feed", "woocommerce"].includes(connectorType)
              ? "ecommerce"
              : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create tenant");

      setApiKey(json.apiKey);
      setTenantId(json.tenantId);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const mcpEndpoint = `${process.env.NEXT_PUBLIC_MCP_SERVER_URL ?? "https://mcp.mcpaas.dev"}/api/${slug}/mcp`;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">MCPaaS</h1>
          <p className="text-gray-400 mt-1">Set up your MCP integration</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex items-center gap-2 flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step > n
                    ? "bg-green-500 text-white"
                    : step === n
                    ? "bg-blue-500 text-white"
                    : "bg-gray-800 text-gray-500"
                }`}
              >
                {step > n ? "✓" : n}
              </div>
              {n < 4 && <div className={`flex-1 h-0.5 ${step > n ? "bg-green-500" : "bg-gray-800"}`} />}
            </div>
          ))}
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">

          {/* ── Step 1: Business info ── */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Tell us about your business</h2>
              <p className="text-sm text-gray-400 mb-6">This creates your MCPaaS merchant account.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Business name</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => {
                      setBusinessName(e.target.value);
                      const derived = deriveSlug(e.target.value);
                      setSlug(derived);
                      setSlugAvailable(null);
                    }}
                    placeholder="Acme Store"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Slug <span className="text-gray-600">(your unique identifier)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => {
                        setSlug(e.target.value);
                        setSlugAvailable(null);
                      }}
                      onBlur={() => checkSlug(slug)}
                      placeholder="acme-store"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
                    />
                    {slugAvailable === true && (
                      <span className="text-xs text-green-400">Available</span>
                    )}
                    {slugAvailable === false && (
                      <span className="text-xs text-red-400">Taken</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Your MCP endpoint: <span className="text-gray-400">/api/{slug}/mcp</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => { checkSlug(slug); setStep(2); }}
                disabled={!businessName || !slug}
                className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                Continue
              </button>
            </div>
          )}

          {/* ── Step 2: Choose connector ── */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">How do you want to connect?</h2>
              <p className="text-sm text-gray-400 mb-6">Choose how we fetch your data to generate MCP tools.</p>

              <div className="space-y-3">
                {CONNECTOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setConnectorType(opt.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors ${
                      connectorType === opt.id
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-gray-700 hover:border-gray-600 bg-gray-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white text-sm">{opt.label}</span>
                      {opt.badge && (
                        <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {/* MongoDB domain sub-selector */}
              {connectorType === "mongodb" && (
                <div className="mt-4 bg-gray-800/50 rounded-xl border border-gray-700 p-4">
                  <p className="text-sm text-gray-300 mb-3">What kind of data does your MongoDB collection contain?</p>
                  <div className="space-y-2">
                    {([
                      { id: "rental" as const, label: "Rental / Real Estate", desc: "Tools: search_properties, schedule_visit, etc." },
                      { id: "ecommerce" as const, label: "E-commerce / Products", desc: "Tools: search_products, cart, checkout" },
                    ]).map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setMongoDomain(opt.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          mongoDomain === opt.id
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-gray-700 hover:border-gray-600 bg-gray-800"
                        }`}
                      >
                        <span className="text-sm font-medium text-white">{opt.label}</span>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Review + deploy ── */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Review & deploy</h2>
              <p className="text-sm text-gray-400 mb-6">Create your MCPaaS account and get your MCP endpoint.</p>

              <div className="space-y-3 mb-6">
                <ReviewRow label="Business name" value={businessName} />
                <ReviewRow label="Slug" value={slug} mono />
                <ReviewRow
                  label="Connector"
                  value={CONNECTOR_OPTIONS.find((o) => o.id === connectorType)?.label ?? connectorType}
                />
                <ReviewRow label="MCP endpoint" value={`/api/${slug}/mcp`} mono />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 mb-4">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
                >
                  Back
                </button>
                <button
                  onClick={createTenant}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
                >
                  {loading ? "Creating..." : "Create & deploy"}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Done! Show credentials ── */}
          {step === 4 && apiKey && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <span className="text-green-400 text-lg">✓</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">You&apos;re live!</h2>
                  <p className="text-sm text-gray-400">{businessName} is now on MCPaaS</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">
                    MCP Endpoint
                  </label>
                  <CopyBox value={mcpEndpoint} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">
                    API Key <span className="text-yellow-400">(save this — shown only once)</span>
                  </label>
                  <CopyBox value={apiKey} mono />
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-6">
                Add your API key as a Bearer token in the Authorization header when connecting from Claude, ChatGPT, or any MCP client.
              </p>

              <button
                onClick={() => router.push("/")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                Go to dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-800">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-sm text-white ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function CopyBox({ value, mono = false }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5">
      <span className={`flex-1 text-sm text-gray-200 truncate ${mono ? "font-mono" : ""}`}>{value}</span>
      <button
        onClick={copy}
        className="text-xs text-gray-400 hover:text-white transition-colors flex-shrink-0"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
