-- MCPaaS: Visit Requests table (CribLiv POC)
-- Tracks property visit scheduling through AI agents

CREATE TABLE IF NOT EXISTS visit_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  visitor_name    TEXT NOT NULL,
  visitor_phone   TEXT NOT NULL,
  visitor_email   TEXT,
  preferred_date  DATE NOT NULL,
  preferred_time  TEXT NOT NULL CHECK (preferred_time IN ('morning', 'afternoon', 'evening')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  notes           TEXT,
  session_id      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_requests_tenant
  ON visit_requests(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_visit_requests_property
  ON visit_requests(property_id, created_at DESC);
