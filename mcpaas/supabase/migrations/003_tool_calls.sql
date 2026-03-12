-- MCPaaS: Tool Calls telemetry table
-- Logs every MCP tool invocation for analytics and debugging

CREATE TABLE IF NOT EXISTS tool_calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tool_name       TEXT NOT NULL,
  input_params    JSONB NOT NULL,
  output          JSONB,
  result_count    INTEGER,
  status          TEXT NOT NULL CHECK (status IN ('success', 'error', 'policy_blocked')),
  error_message   TEXT,
  latency_ms      INTEGER NOT NULL,
  agent_platform  TEXT NOT NULL DEFAULT 'unknown' CHECK (agent_platform IN ('chatgpt', 'claude', 'gemini', 'browser', 'unknown')),
  session_id      TEXT,
  user_ip         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dashboard queries: recent tool calls by tenant
CREATE INDEX IF NOT EXISTS idx_tool_calls_tenant_created
  ON tool_calls(tenant_id, created_at DESC);

-- Per-tool analytics
CREATE INDEX IF NOT EXISTS idx_tool_calls_tenant_tool
  ON tool_calls(tenant_id, tool_name, created_at DESC);

-- Session grouping
CREATE INDEX IF NOT EXISTS idx_tool_calls_session
  ON tool_calls(session_id)
  WHERE session_id IS NOT NULL;
