-- 008_products.sql
-- Products table for ecommerce MongoDB/Feed tenants (parallel to properties for rental)

CREATE TABLE IF NOT EXISTS products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  external_id  TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'INR',
  inventory    INTEGER,
  images       TEXT[] DEFAULT '{}',
  categories   TEXT[] DEFAULT '{}',
  attributes   JSONB NOT NULL DEFAULT '{}',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_products_tenant
  ON products(tenant_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_title
  ON products USING GIN(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_products_categories
  ON products USING GIN(categories);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
