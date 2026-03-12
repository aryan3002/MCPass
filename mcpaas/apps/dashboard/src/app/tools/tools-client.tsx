"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TenantToolDef, ToolStat } from "@/lib/queries";

interface CriblivTool {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  type: string;
  params: string[];
  handlerType: string;
  handlerConfig: Record<string, unknown> | null;
  inputSchema: Record<string, unknown>;
  isCodeDefined: boolean;
}

interface ToolFormData {
  name: string;
  description: string;
  handlerType: "webhook" | "static" | "connector";
  webhookUrl: string;
  staticData: string;
  parameters: ParamDef[];
}

interface ParamDef {
  name: string;
  type: "string" | "number" | "boolean" | "array";
  description: string;
  required: boolean;
}

const EMPTY_FORM: ToolFormData = {
  name: "",
  description: "",
  handlerType: "webhook",
  webhookUrl: "",
  staticData: '{\n  "message": "Hello from my tool!"\n}',
  parameters: [],
};

export default function ToolsClient({
  tenantName,
  isCribliv,
  criblivTools,
  dbTools,
  toolStats,
  connectorType,
}: {
  tenantName: string;
  isCribliv: boolean;
  criblivTools: CriblivTool[];
  dbTools: TenantToolDef[];
  toolStats: ToolStat[];
  connectorType: string;
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ToolFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const statsMap = Object.fromEntries(toolStats.map((t) => [t.name, t]));
  const totalTools = criblivTools.length + dbTools.length;

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError(null);
    setShowCreate(true);
  }

  function openEdit(tool: TenantToolDef) {
    const params: ParamDef[] = [];
    const props = (tool.inputSchema?.properties ?? {}) as Record<string, { type?: string; description?: string }>;
    const required = ((tool.inputSchema?.required ?? []) as string[]);
    for (const [name, schema] of Object.entries(props)) {
      params.push({
        name,
        type: (schema.type as ParamDef["type"]) ?? "string",
        description: schema.description ?? "",
        required: required.includes(name),
      });
    }

    const handlerConfig = (tool.handlerConfig ?? {}) as Record<string, unknown>;

    setForm({
      name: tool.name,
      description: tool.description,
      handlerType: tool.handlerType as ToolFormData["handlerType"],
      webhookUrl: (handlerConfig.url as string) ?? "",
      staticData: handlerConfig.data ? JSON.stringify(handlerConfig.data, null, 2) : "{}",
      parameters: params,
    });
    setEditingId(tool.id);
    setError(null);
    setShowCreate(true);
  }

  function buildInputSchema(params: ParamDef[]) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const p of params) {
      properties[p.name] = {
        type: p.type,
        description: p.description || undefined,
      };
      if (p.required) required.push(p.name);
    }
    return { type: "object", properties, required };
  }

  function buildHandlerConfig() {
    if (form.handlerType === "webhook") {
      return { url: form.webhookUrl };
    }
    if (form.handlerType === "static") {
      try {
        return { data: JSON.parse(form.staticData) };
      } catch {
        return { data: {} };
      }
    }
    return null;
  }

  async function saveTool() {
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name,
      description: form.description,
      handlerType: form.handlerType,
      handlerConfig: buildHandlerConfig(),
      inputSchema: buildInputSchema(form.parameters),
    };

    try {
      const url = editingId ? `/api/tools/${editingId}` : "/api/tools";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setShowCreate(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTool(toolId: string) {
    await fetch(`/api/tools/${toolId}/toggle`, { method: "POST" });
    router.refresh();
  }

  async function deleteTool(toolId: string) {
    await fetch(`/api/tools/${toolId}`, { method: "DELETE" });
    setDeleteConfirm(null);
    router.refresh();
  }

  function addParam() {
    setForm({
      ...form,
      parameters: [...form.parameters, { name: "", type: "string", description: "", required: false }],
    });
  }

  function updateParam(idx: number, updates: Partial<ParamDef>) {
    const params = [...form.parameters];
    params[idx] = { ...params[idx], ...updates };
    setForm({ ...form, parameters: params });
  }

  function removeParam(idx: number) {
    setForm({ ...form, parameters: form.parameters.filter((_, i) => i !== idx) });
  }

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Tool Catalog</h2>
          <p className="text-gray-400 text-sm mt-1">
            {totalTools > 0 ? `${totalTools} MCP tools for ${tenantName}` : "No tools configured yet"}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Tool
        </button>
      </div>

      {/* CribLiv code-defined tools (read-only) */}
      {isCribliv && criblivTools.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Built-in Tools</h3>
            <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full">
              CribLiv
            </span>
          </div>
          <div className="space-y-3">
            {criblivTools.map((tool) => (
              <ToolCard
                key={tool.id}
                name={tool.name}
                description={tool.description}
                type={tool.type}
                isEnabled={true}
                params={tool.params}
                stats={statsMap[tool.name]}
                isCodeDefined
              />
            ))}
          </div>
        </div>
      )}

      {/* DB-driven tools */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Custom Tools</h3>
          <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
            {connectorType}
          </span>
        </div>

        {dbTools.length === 0 && !showCreate ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 border-dashed p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.9-3.4a1 1 0 010-1.73l5.9-3.4a1 1 0 011.16 0l5.9 3.4a1 1 0 010 1.73l-5.9 3.4a1 1 0 01-1.16 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.52 16.28l5.9 3.4a1 1 0 001.16 0l5.9-3.4" />
              </svg>
            </div>
            <p className="text-gray-400 mb-2 font-medium">No custom tools yet</p>
            <p className="text-gray-500 text-sm mb-5">
              Create your first MCP tool to make it available to AI agents like Claude and ChatGPT.
            </p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create your first tool
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {dbTools.map((tool) => (
              <ToolCard
                key={tool.id}
                name={tool.name}
                description={tool.description}
                type={tool.handlerType === "webhook" ? "Webhook" : tool.handlerType === "static" ? "Static" : "Connector"}
                isEnabled={tool.isEnabled}
                params={Object.keys((tool.inputSchema?.properties as object) ?? {})}
                stats={statsMap[tool.name]}
                version={tool.version}
                onEdit={() => openEdit(tool)}
                onToggle={() => toggleTool(tool.id)}
                onDelete={() => setDeleteConfirm(tool.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── CREATE/EDIT MODAL ──────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl mb-16 shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h3 className="text-lg font-semibold text-white">
                {editingId ? "Edit Tool" : "Create New Tool"}
              </h3>
              <button
                onClick={() => setShowCreate(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Tool name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                  placeholder="search_products"
                  disabled={!!editingId}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono disabled:opacity-50"
                />
                <p className="text-xs text-gray-600 mt-1">Lowercase letters, numbers, underscores only. Cannot be changed after creation.</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe what this tool does. AI agents see this to decide when to use it."
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-none"
                />
                <p className="text-xs text-gray-600 mt-1">Write a clear description — this is what AI agents read to understand your tool.</p>
              </div>

              {/* Handler type */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Handler type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["webhook", "static", "connector"] as const).map((ht) => (
                    <button
                      key={ht}
                      onClick={() => setForm({ ...form, handlerType: ht })}
                      className={`p-3 rounded-lg border text-sm text-left transition-colors ${
                        form.handlerType === ht
                          ? "border-blue-500 bg-blue-500/10 text-white"
                          : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                      }`}
                    >
                      <span className="block font-medium capitalize">{ht}</span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        {ht === "webhook" && "Calls your API endpoint"}
                        {ht === "static" && "Returns fixed data"}
                        {ht === "connector" && "Uses connected source"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Webhook URL */}
              {form.handlerType === "webhook" && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Webhook URL</label>
                  <input
                    type="url"
                    value={form.webhookUrl}
                    onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                    placeholder="https://api.yoursite.com/search"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
                  />
                  <p className="text-xs text-gray-600 mt-1">MCPaaS will POST tool input as JSON body to this URL.</p>
                </div>
              )}

              {/* Static data */}
              {form.handlerType === "static" && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Static response data (JSON)</label>
                  <textarea
                    value={form.staticData}
                    onChange={(e) => setForm({ ...form, staticData: e.target.value })}
                    rows={5}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono resize-none"
                  />
                </div>
              )}

              {/* Parameters */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400">Input parameters</label>
                  <button
                    onClick={addParam}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    + Add parameter
                  </button>
                </div>

                {form.parameters.length === 0 ? (
                  <div className="bg-gray-800/50 border border-gray-700/50 border-dashed rounded-lg p-4 text-center">
                    <p className="text-xs text-gray-500">No parameters defined. Tool will accept no input.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {form.parameters.map((param, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-gray-800/50 rounded-lg p-3">
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={param.name}
                            onChange={(e) => updateParam(idx, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_") })}
                            placeholder="param_name"
                            className="bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                          />
                          <select
                            value={param.type}
                            onChange={(e) => updateParam(idx, { type: e.target.value as ParamDef["type"] })}
                            className="bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                          >
                            <option value="string">string</option>
                            <option value="number">number</option>
                            <option value="boolean">boolean</option>
                            <option value="array">array</option>
                          </select>
                          <input
                            type="text"
                            value={param.description}
                            onChange={(e) => updateParam(idx, { description: e.target.value })}
                            placeholder="Description"
                            className="bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-gray-400 mt-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={param.required}
                            onChange={(e) => updateParam(idx, { required: e.target.checked })}
                            className="rounded border-gray-600"
                          />
                          Req
                        </label>
                        <button
                          onClick={() => removeParam(idx)}
                          className="text-gray-500 hover:text-red-400 transition-colors mt-1.5"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5 text-sm text-red-400">
                  {error}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveTool}
                disabled={saving || !form.name || !form.description}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
              >
                {saving ? "Saving..." : editingId ? "Update Tool" : "Create Tool"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRM ─────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Tool</h3>
            <p className="text-sm text-gray-400 mb-6">
              This will permanently remove this tool and it will no longer be available to AI agents. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTool(deleteConfirm)}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                Delete Tool
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TOOL CARD COMPONENT ──────────────────────────────────────
function ToolCard({
  name,
  description,
  type,
  isEnabled,
  params,
  stats,
  version,
  isCodeDefined,
  onEdit,
  onToggle,
  onDelete,
}: {
  name: string;
  description: string;
  type: string;
  isEnabled: boolean;
  params: string[];
  stats?: ToolStat;
  version?: number;
  isCodeDefined?: boolean;
  onEdit?: () => void;
  onToggle?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 p-5 transition-opacity ${!isEnabled ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <h3 className="font-mono text-blue-400 font-semibold">{name}</h3>
          {!isEnabled && (
            <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">Disabled</span>
          )}
          {isCodeDefined && (
            <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full border border-gray-700">Read-only</span>
          )}
          {version && (
            <span className="text-xs text-gray-600">v{version}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <span className="text-xs text-gray-500">{stats.calls} calls</span>
          )}
          <TypeBadge type={type} />
          {!isCodeDefined && (
            <div className="flex items-center gap-1">
              {onToggle && (
                <button
                  onClick={onToggle}
                  className={`w-9 h-5 rounded-full transition-colors relative ${isEnabled ? "bg-blue-600" : "bg-gray-700"}`}
                  title={isEnabled ? "Disable" : "Enable"}
                >
                  <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all ${isEnabled ? "right-0.5" : "left-0.5"}`} />
                </button>
              )}
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="p-1.5 text-gray-500 hover:text-blue-400 transition-colors"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-300 mb-3">{description}</p>
      {params.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {params.map((param) => (
            <span key={param} className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-1 rounded">
              {param}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Transaction: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    Webhook: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    Discovery: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    Connector: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    Static: "bg-green-500/10 text-green-400 border border-green-500/20",
    Information: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
    code: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${colors[type] ?? "bg-gray-500/10 text-gray-400 border border-gray-500/20"}`}>
      {type}
    </span>
  );
}
