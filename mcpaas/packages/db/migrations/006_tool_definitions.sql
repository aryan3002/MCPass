-- MCPaaS: Tool definitions table
-- Stores DB-driven tool definitions for multi-tenant merchants.
-- Merchants with connectorType="cribliv" still use code-defined tools;
-- all other tenants use rows in this table.

CREATE TABLE IF NOT EXISTS tool_definitions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,           -- e.g. "search_products"
  description    TEXT NOT NULL,           -- natural language for LLM reasoning
  input_schema   JSONB NOT NULL,          -- JSON Schema for parameters
  handler_type   TEXT NOT NULL CHECK (handler_type IN ('connector', 'webhook', 'static')),
  handler_config JSONB,                   -- method name for connector, URL for webhook, JSON for static
  is_enabled     BOOLEAN NOT NULL DEFAULT true,
  version        INTEGER NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, name)               -- one tool name per tenant
);

CREATE INDEX IF NOT EXISTS idx_tool_definitions_tenant ON tool_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tool_definitions_tenant_enabled ON tool_definitions(tenant_id, is_enabled);

CREATE TRIGGER update_tool_definitions_updated_at
  BEFORE UPDATE ON tool_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
