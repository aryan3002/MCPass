"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ConnectorsProps {
  currentConnector: string;
  tenantSlug: string;
  tenantId: string;
}

type Tab = "overview" | "shopify" | "feed" | "custom-api" | "mongodb";

export default function ConnectorsClient({ currentConnector, tenantSlug, tenantId }: ConnectorsProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [feedUrl, setFeedUrl] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const [shopAccessToken, setShopAccessToken] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [apiAuthHeader, setApiAuthHeader] = useState("");
  const [apiEndpoints, setApiEndpoints] = useState([
    { path: "", method: "GET", toolName: "", description: "" },
  ]);
  const [mongoUri, setMongoUri] = useState("");
  const [mongoCollection, setMongoCollection] = useState("properties");
  const [mongoDomain, setMongoDomain] = useState<"rental" | "ecommerce">("rental");
  const [shopStorefrontToken, setShopStorefrontToken] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addEndpoint() {
    setApiEndpoints([...apiEndpoints, { path: "", method: "GET", toolName: "", description: "" }]);
  }

  function updateEndpoint(idx: number, updates: Partial<(typeof apiEndpoints)[0]>) {
    const eps = [...apiEndpoints];
    eps[idx] = { ...eps[idx]!, ...updates };
    setApiEndpoints(eps);
  }

  function removeEndpoint(idx: number) {
    setApiEndpoints(apiEndpoints.filter((_, i) => i !== idx));
  }

  async function setupConnector(connectorType: string, config: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/connectors/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectorType, config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(data.message || "Connector configured successfully!");
      setTimeout(() => setSuccess(null), 5000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to setup connector");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Connectors</h2>
        <p className="text-gray-400 text-sm mt-1">
          Connect your data source to automatically generate MCP tools for AI agents.
        </p>
      </div>

      {success && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-sm text-green-400 mb-6">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {/* Current connector badge */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Active connector</p>
            <p className="text-lg font-semibold text-white capitalize mt-0.5">{currentConnector}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-green-400">Connected</span>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex items-center gap-1 mb-6 bg-gray-900 rounded-lg p-1 border border-gray-800 w-fit">
        {([
          { id: "overview", label: "Overview" },
          { id: "mongodb", label: "MongoDB" },
          { id: "shopify", label: "Shopify" },
          { id: "feed", label: "Product Feed" },
          { id: "custom-api", label: "Custom API" },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-md text-sm transition-colors ${
              tab === t.id
                ? "bg-gray-800 text-white font-medium"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── OVERVIEW TAB ─────────────────────────────────── */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ConnectorCard
            name="MongoDB"
            description="Connect your MongoDB cluster. MCPaaS syncs your rental or product collection into the MCP tool layer. Ideal for CribLiv, real estate, and custom data models."
            active={currentConnector === "mongodb"}
            onClick={() => setTab("mongodb")}
          />
          <ConnectorCard
            name="Shopify"
            description="Connect your Shopify store with access credentials. MCPaaS auto-imports your product catalog, inventory, and creates checkout tools."
            badge="Most popular"
            active={currentConnector === "shopify"}
            onClick={() => setTab("shopify")}
          />
          <ConnectorCard
            name="Product Feed"
            description="Provide a JSON, CSV, or Google Shopping XML feed URL. MCPaaS parses it and generates search + detail tools."
            active={currentConnector === "feed"}
            onClick={() => setTab("feed")}
          />
          <ConnectorCard
            name="Custom REST API"
            description="Map your existing REST API endpoints to MCP tools. Full control over request/response mapping."
            active={currentConnector === "custom-api"}
            onClick={() => setTab("custom-api")}
          />
        </div>
      )}

      {/* ─── MONGODB TAB ─────────────────────────────────── */}
      {tab === "mongodb" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-xl">
          <h3 className="font-semibold text-white mb-1">Connect MongoDB</h3>
          <p className="text-sm text-gray-500 mb-6">
            Paste your MongoDB connection URI and collection name. MCPaaS will sync your documents
            into the MCP tool layer — search, details, availability, and more will work immediately.
          </p>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">MongoDB Connection URI</label>
              <input
                type="password"
                value={mongoUri}
                onChange={(e) => setMongoUri(e.target.value)}
                placeholder="mongodb+srv://user:pass@cluster.mongodb.net/dbname"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
              />
              <p className="text-xs text-gray-600 mt-1">
                Find this in MongoDB Atlas → Connect → Drivers. Stored encrypted.
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Collection Name</label>
              <input
                type="text"
                value={mongoCollection}
                onChange={(e) => setMongoCollection(e.target.value)}
                placeholder="properties"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
              />
              <p className="text-xs text-gray-600 mt-1">
                The collection that holds your documents.
              </p>
            </div>

            {/* Domain selector */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Business Domain</label>
              <div className="flex gap-2">
                {([
                  { id: "rental" as const, label: "Rental / Real Estate" },
                  { id: "ecommerce" as const, label: "E-commerce / Products" },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setMongoDomain(opt.id)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm border transition-colors ${
                      mongoDomain === opt.id
                        ? "border-blue-500 bg-blue-500/10 text-white"
                        : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-400">
              <p className="font-medium text-gray-300 mb-2">Tools that will be activated:</p>
              {mongoDomain === "rental" ? (
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2"><span className="text-green-400">+</span> search_properties</li>
                  <li className="flex items-center gap-2"><span className="text-green-400">+</span> get_property_details</li>
                  <li className="flex items-center gap-2"><span className="text-green-400">+</span> check_availability</li>
                  <li className="flex items-center gap-2"><span className="text-green-400">+</span> compare_properties</li>
                  <li className="flex items-center gap-2"><span className="text-green-400">+</span> schedule_visit</li>
                  <li className="flex items-center gap-2"><span className="text-green-400">+</span> get_neighborhood_info</li>
                </ul>
              ) : (
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2"><span className="text-green-400">+</span> search_products</li>
                  <li className="flex items-center gap-2"><span className="text-green-400">+</span> get_product_details</li>
                  <li className="flex items-center gap-2"><span className="text-green-400">+</span> check_inventory</li>
                </ul>
              )}
            </div>
          </div>

          {syncResult && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 text-sm text-blue-400 mb-4">
              {syncResult}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setupConnector("mongodb", { mongoUri, collection: mongoCollection })}
              disabled={saving || !mongoUri || !mongoCollection}
              className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white font-medium py-3 rounded-lg text-sm transition-colors"
            >
              {saving ? "Saving..." : "Save credentials"}
            </button>
            <button
              onClick={async () => {
                setSyncing(true);
                setSyncResult(null);
                setError(null);
                try {
                  await setupConnector("mongodb", { mongoUri, collection: mongoCollection });
                  const res = await fetch("/api/connectors/sync", { method: "POST" });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error);
                  setSyncResult(data.message);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Sync failed");
                } finally {
                  setSyncing(false);
                }
              }}
              disabled={syncing || !mongoUri || !mongoCollection}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-medium py-3 rounded-lg text-sm transition-colors"
            >
              {syncing ? "Syncing..." : "Save & Sync now"}
            </button>
          </div>
        </div>
      )}

      {/* ─── SHOPIFY TAB ──────────────────────────────────── */}
      {tab === "shopify" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-xl">
          <h3 className="font-semibold text-white mb-1">Connect Shopify</h3>
          <p className="text-sm text-gray-500 mb-6">
            Enter your Shopify store domain and Admin API access token.
            We&apos;ll auto-generate tools for product search, details, inventory, and checkout.
          </p>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Store Domain</label>
              <input
                type="text"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="your-store.myshopify.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Admin API Access Token</label>
              <input
                type="password"
                value={shopAccessToken}
                onChange={(e) => setShopAccessToken(e.target.value)}
                placeholder="shpat_..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
              />
              <p className="text-xs text-gray-600 mt-1">
                Create one in Shopify Admin &gt; Settings &gt; Apps &gt; Develop apps.
              </p>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-400">
              <p className="font-medium text-gray-300 mb-2">Tools we&apos;ll create:</p>
              <ul className="space-y-1.5">
                <li className="flex items-center gap-2"><span className="text-green-400">+</span> search_products</li>
                <li className="flex items-center gap-2"><span className="text-green-400">+</span> get_product_details</li>
                <li className="flex items-center gap-2"><span className="text-green-400">+</span> check_inventory</li>
                <li className="flex items-center gap-2"><span className="text-green-400">+</span> create_cart</li>
                <li className="flex items-center gap-2"><span className="text-green-400">+</span> add_to_cart</li>
                <li className="flex items-center gap-2"><span className="text-green-400">+</span> get_checkout_url</li>
              </ul>
            </div>
          </div>

          <button
            onClick={() => setupConnector("shopify", { shopDomain, accessToken: shopAccessToken })}
            disabled={saving || !shopDomain || !shopAccessToken}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-medium py-3 rounded-lg text-sm transition-colors"
          >
            {saving ? "Connecting..." : "Connect Shopify Store"}
          </button>
        </div>
      )}

      {/* ─── FEED TAB ─────────────────────────────────────── */}
      {tab === "feed" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-xl">
          <h3 className="font-semibold text-white mb-1">Product Feed</h3>
          <p className="text-sm text-gray-500 mb-6">
            Provide a URL to your product feed (CSV, JSON, or Google Shopping XML).
            MCPaaS will fetch, parse, and generate MCP tools automatically.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Feed URL</label>
              <input
                type="url"
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
                placeholder="https://yourshop.com/products.json"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
              />
              <p className="text-xs text-gray-600 mt-1">
                Supported: JSON, CSV, Google Shopping XML, RSS feed
              </p>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-400">
              <p className="font-medium text-gray-300 mb-2">Tools we&apos;ll create:</p>
              <ul className="space-y-1.5">
                <li className="flex items-center gap-2"><span className="text-green-400">+</span> search_products</li>
                <li className="flex items-center gap-2"><span className="text-green-400">+</span> get_product_details</li>
                <li className="flex items-center gap-2"><span className="text-green-400">+</span> check_inventory</li>
              </ul>
            </div>
          </div>

          <button
            onClick={() => setupConnector("feed", { feedUrl })}
            disabled={saving || !feedUrl}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium py-3 rounded-lg text-sm mt-6 transition-colors"
          >
            {saving ? "Importing..." : "Import Feed & Generate Tools"}
          </button>
        </div>
      )}

      {/* ─── CUSTOM API TAB ───────────────────────────────── */}
      {tab === "custom-api" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-2xl">
          <h3 className="font-semibold text-white mb-1">Custom REST API</h3>
          <p className="text-sm text-gray-500 mb-6">
            Map your existing API endpoints to MCP tools. MCPaaS will proxy agent requests to your API.
          </p>

          <div className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Base URL</label>
              <input
                type="url"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="https://api.yourapp.com/v1"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Authorization (optional)</label>
              <input
                type="text"
                value={apiAuthHeader}
                onChange={(e) => setApiAuthHeader(e.target.value)}
                placeholder="Bearer sk-... or Basic base64..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
              />
              <p className="text-xs text-gray-600 mt-1">Sent as the Authorization header with every request.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm text-gray-400">API Endpoints</label>
                <button onClick={addEndpoint} className="text-xs text-blue-400 hover:text-blue-300">
                  + Add endpoint
                </button>
              </div>

              <div className="space-y-3">
                {apiEndpoints.map((ep, idx) => (
                  <div key={idx} className="bg-gray-800/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={ep.method}
                        onChange={(e) => updateEndpoint(idx, { method: e.target.value })}
                        className="bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 w-24"
                      >
                        <option>GET</option>
                        <option>POST</option>
                        <option>PUT</option>
                        <option>DELETE</option>
                      </select>
                      <input
                        type="text"
                        value={ep.path}
                        onChange={(e) => updateEndpoint(idx, { path: e.target.value })}
                        placeholder="/products/search"
                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                      {apiEndpoints.length > 1 && (
                        <button
                          onClick={() => removeEndpoint(idx)}
                          className="text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={ep.toolName}
                        onChange={(e) => updateEndpoint(idx, { toolName: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                        placeholder="tool_name"
                        className="bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        value={ep.description}
                        onChange={(e) => updateEndpoint(idx, { description: e.target.value })}
                        placeholder="What does this endpoint do?"
                        className="bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() =>
              setupConnector("custom-api", {
                baseUrl: apiBaseUrl,
                authHeader: apiAuthHeader,
                endpoints: apiEndpoints.filter((ep) => ep.path && ep.toolName),
              })
            }
            disabled={saving || !apiBaseUrl || apiEndpoints.every((ep) => !ep.path)}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium py-3 rounded-lg text-sm mt-6 transition-colors"
          >
            {saving ? "Saving..." : "Save & Generate Tools"}
          </button>
        </div>
      )}
    </div>
  );
}

function ConnectorCard({
  name,
  description,
  badge,
  active,
  onClick,
}: {
  name: string;
  description: string;
  badge?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-5 rounded-xl border transition-colors ${
        active
          ? "border-blue-500 bg-blue-500/5"
          : "border-gray-800 bg-gray-900 hover:border-gray-700"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold text-white">{name}</span>
        {badge && (
          <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
        {active && (
          <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">
            Active
          </span>
        )}
      </div>
      <p className="text-sm text-gray-400">{description}</p>
    </button>
  );
}
