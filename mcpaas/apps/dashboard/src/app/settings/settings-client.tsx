"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SettingsProps {
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    config: Record<string, unknown>;
    created_at: string;
  };
  userEmail: string;
}

export default function SettingsClient({ tenant, userEmail }: SettingsProps) {
  const router = useRouter();
  const config = tenant.config as {
    maxToolCallsPerDay?: number;
    enabledSurfaces?: string[];
    connectorType?: string;
  };

  // Business info
  const [businessName, setBusinessName] = useState(tenant.name);
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  // Quotas
  const [dailyQuota, setDailyQuota] = useState(config.maxToolCallsPerDay ?? 1000);
  const [savingQuota, setSavingQuota] = useState(false);
  const [quotaSaved, setQuotaSaved] = useState(false);

  // API key
  const [newKey, setNewKey] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenConfirm, setRegenConfirm] = useState(false);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Error
  const [error, setError] = useState<string | null>(null);

  async function saveBusinessName() {
    setSavingName(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: businessName }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingName(false);
    }
  }

  async function saveQuota() {
    setSavingQuota(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: { maxToolCallsPerDay: dailyQuota } }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setQuotaSaved(true);
      setTimeout(() => setQuotaSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingQuota(false);
    }
  }

  async function regenerateKey() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant/regenerate-key", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setNewKey(json.apiKey);
      setRegenConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate");
    } finally {
      setRegenerating(false);
    }
  }

  async function deleteTenant() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant", { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      window.location.href = "/onboarding";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  function copyKey() {
    if (newKey) navigator.clipboard.writeText(newKey);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-gray-400 text-sm mt-1">Manage your MCPaaS account, API keys, and configurations.</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {/* ─── ACCOUNT INFO ─────────────────────────────────── */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <h3 className="font-semibold text-white mb-4">Account</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Email</label>
            <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-300">
              {userEmail}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Business name</label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={saveBusinessName}
                disabled={savingName || businessName === tenant.name || !businessName.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                {savingName ? "Saving..." : nameSaved ? "Saved" : "Save"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Slug</label>
              <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-300 font-mono">
                {tenant.slug}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Plan</label>
              <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-blue-400 capitalize">
                {tenant.plan}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Connector</label>
              <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-300 capitalize">
                {config.connectorType ?? "manual"}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Created</label>
              <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-300">
                {new Date(tenant.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── API KEY ──────────────────────────────────────── */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <h3 className="font-semibold text-white mb-1">API Key</h3>
        <p className="text-sm text-gray-500 mb-4">
          Used to authenticate MCP requests. Regenerating will invalidate the current key.
        </p>

        {newKey ? (
          <div className="space-y-3">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <p className="text-sm text-green-400 font-medium mb-2">New API key generated</p>
              <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5">
                <code className="flex-1 text-sm text-gray-200 font-mono truncate">{newKey}</code>
                <button onClick={copyKey} className="text-xs text-gray-400 hover:text-white transition-colors flex-shrink-0">
                  Copy
                </button>
              </div>
              <p className="text-xs text-amber-400 mt-2">Save this now — it won't be shown again.</p>
            </div>
            <button
              onClick={() => setNewKey(null)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Dismiss
            </button>
          </div>
        ) : regenConfirm ? (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
            <p className="text-sm text-amber-300 mb-3">
              This will immediately invalidate your current API key. Any agents using the old key will stop working.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setRegenConfirm(false)}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={regenerateKey}
                disabled={regenerating}
                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {regenerating ? "Regenerating..." : "Yes, regenerate key"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setRegenConfirm(true)}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            Regenerate API key
          </button>
        )}
      </section>

      {/* ─── QUOTAS ───────────────────────────────────────── */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <h3 className="font-semibold text-white mb-1">Usage Limits</h3>
        <p className="text-sm text-gray-500 mb-4">
          Configure daily limits for your MCP endpoint.
        </p>

        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Max tool calls per day</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={dailyQuota}
              onChange={(e) => setDailyQuota(parseInt(e.target.value) || 0)}
              min={0}
              max={100000}
              className="w-40 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={saveQuota}
              disabled={savingQuota || dailyQuota === (config.maxToolCallsPerDay ?? 1000)}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              {savingQuota ? "Saving..." : quotaSaved ? "Saved" : "Save"}
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Tool calls exceeding this limit will return a policy_blocked error. Set to 0 for unlimited.
          </p>
        </div>
      </section>

      {/* ─── DANGER ZONE ──────────────────────────────────── */}
      <section className="bg-gray-900 rounded-xl border border-red-500/20 p-6">
        <h3 className="font-semibold text-red-400 mb-1">Danger Zone</h3>
        <p className="text-sm text-gray-500 mb-4">
          Permanently delete your MCPaaS account, all tools, and all data.
        </p>

        {deleteConfirm ? (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
            <p className="text-sm text-red-300 mb-3">
              Type <code className="font-mono bg-gray-800 px-1.5 py-0.5 rounded text-red-400">{tenant.slug}</code> to
              confirm deletion.
            </p>
            <input
              type="text"
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder={tenant.slug}
              className="w-full bg-gray-800 border border-red-500/30 rounded-lg px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-red-500 mb-3"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setDeleteConfirm(false); setDeleteText(""); }}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteTenant}
                disabled={deleting || deleteText !== tenant.slug}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {deleting ? "Deleting..." : "Permanently delete account"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            Delete this account
          </button>
        )}
      </section>
    </div>
  );
}
