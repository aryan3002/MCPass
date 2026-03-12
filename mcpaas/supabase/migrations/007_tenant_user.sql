-- MCPaaS: Link tenants to Supabase auth users
-- Each merchant account is tied to one auth.users row.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON tenants(user_id);
