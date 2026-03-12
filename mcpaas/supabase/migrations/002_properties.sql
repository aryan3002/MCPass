-- MCPaaS: Properties table (CribLiv POC)
-- Stores rental listings with full metadata for MCP tool queries

CREATE TABLE IF NOT EXISTS properties (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  listing_id      TEXT NOT NULL,
  title           TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('apartment', 'pg', 'villa', 'studio')),
  bedrooms        INTEGER,
  rent_monthly    INTEGER NOT NULL,
  deposit         INTEGER,
  area_sqft       INTEGER,
  locality        TEXT NOT NULL,
  city            TEXT NOT NULL,
  address         TEXT,
  amenities       TEXT[] NOT NULL DEFAULT '{}',
  furnishing      TEXT CHECK (furnishing IN ('Furnished', 'Semi-Furnished', 'Unfurnished')),
  available_from  DATE,
  is_verified     BOOLEAN NOT NULL DEFAULT false,
  photos          TEXT[] DEFAULT '{}',
  description     TEXT,
  lease_duration  TEXT,
  preferred_tenants TEXT,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  owner_contact   TEXT,  -- NEVER exposed through MCP tools
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite search index for fast property search
CREATE INDEX IF NOT EXISTS idx_properties_search
  ON properties(tenant_id, city, locality, type, bedrooms, rent_monthly)
  WHERE is_active = true;

-- GIN index for amenity array containment queries (@>)
CREATE INDEX IF NOT EXISTS idx_properties_amenities
  ON properties USING GIN(amenities);

-- Tenant + listing_id uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_tenant_listing
  ON properties(tenant_id, listing_id);

-- Auto-update updated_at
CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
