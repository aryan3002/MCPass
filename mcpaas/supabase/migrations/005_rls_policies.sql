-- MCPaaS: Row Level Security policies
-- Ensures strict tenant isolation at the database level

-- Enable RLS on all tables
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_requests ENABLE ROW LEVEL SECURITY;

-- Service role (used by MCP server) bypasses RLS by default in Supabase
-- These policies are for authenticated dashboard access

-- Properties: tenants can only see their own
CREATE POLICY tenant_isolation_properties ON properties
  FOR ALL
  USING (tenant_id = auth.uid()::UUID OR current_setting('app.current_tenant_id', TRUE)::UUID = tenant_id);

-- Tool calls: tenants can only see their own
CREATE POLICY tenant_isolation_tool_calls ON tool_calls
  FOR ALL
  USING (tenant_id = auth.uid()::UUID OR current_setting('app.current_tenant_id', TRUE)::UUID = tenant_id);

-- Visit requests: tenants can only see their own
CREATE POLICY tenant_isolation_visits ON visit_requests
  FOR ALL
  USING (tenant_id = auth.uid()::UUID OR current_setting('app.current_tenant_id', TRUE)::UUID = tenant_id);
