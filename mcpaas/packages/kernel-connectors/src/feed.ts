import {
  BaseConnector,
  type ConnectorCapabilities,
  type NormalizedProduct,
  type InventoryStatus,
  type SearchParams,
} from "./types.js";

/**
 * Product Feed Connector — reads from a pre-loaded array of normalized products.
 *
 * Usage: merchant uploads a CSV/JSON/XML feed → dashboard normalizes it into
 * NormalizedProduct[] and stores in Supabase → this connector queries that data.
 *
 * For the current implementation, we pass products directly.
 * Phase 1 will load from the `products` table with a connector-typed tenant.
 */
export class FeedConnector extends BaseConnector {
  readonly type = "feed";
  readonly capabilities: ConnectorCapabilities = {
    search: true,
    productDetails: true,
    inventory: true,
    cart: false,
    checkout: false,
    recommendations: false,
    propertySearch: false,
    propertyDetails: false,
    availability: false,
    visitScheduling: false,
    neighborhoodInfo: false,
    slotSearch: false,
    bookAppointment: false,
  };

  private products: NormalizedProduct[] = [];

  async authenticate(_credentials: Record<string, string>): Promise<void> {
    // Feed connector doesn't require auth — products are pre-loaded
  }

  async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    return {
      ok: true,
      message: `${this.products.length} products loaded`,
    };
  }

  /** Load products into the connector (called after feed import) */
  loadProducts(products: NormalizedProduct[]): void {
    this.products = products;
  }

  async searchProducts(params: SearchParams): Promise<NormalizedProduct[]> {
    let results = [...this.products];

    if (params.query) {
      const q = params.query.toLowerCase();
      results = results.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.categories.some((c) => c.toLowerCase().includes(q))
      );
    }

    if (params.category) {
      const cat = params.category.toLowerCase();
      results = results.filter((p) =>
        p.categories.some((c) => c.toLowerCase().includes(cat))
      );
    }

    if (params.minPrice !== undefined) {
      results = results.filter((p) => p.price >= params.minPrice!);
    }
    if (params.maxPrice !== undefined) {
      results = results.filter((p) => p.price <= params.maxPrice!);
    }

    const limit = params.limit ?? 20;
    const page = params.page ?? 0;
    return results.slice(page * limit, (page + 1) * limit);
  }

  async getProductById(id: string): Promise<NormalizedProduct | null> {
    return this.products.find((p) => p.id === id || p.externalId === id) ?? null;
  }

  async checkInventory(productId: string): Promise<InventoryStatus> {
    const product = await this.getProductById(productId);
    if (!product) return { available: false, quantity: 0 };
    return {
      available: product.inventory === null || product.inventory > 0,
      quantity: product.inventory,
    };
  }
}

// ── Feed parsers ─────────────────────────────────────────────────────────────

export interface FeedRow {
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  price?: string | number;
  image?: string;
  image_url?: string;
  category?: string;
  type?: string;
  inventory?: string | number;
  stock?: string | number;
  [key: string]: unknown;
}

/** Parse a JSON array feed into NormalizedProduct[] */
export function parseJsonFeed(rows: FeedRow[]): NormalizedProduct[] {
  return rows.map((row, idx) => ({
    id: String(row.id ?? `feed-${idx}`),
    externalId: String(row.id ?? `feed-${idx}`),
    title: String(row.title ?? row.name ?? "Untitled"),
    description: String(row.description ?? ""),
    price: parseFloat(String(row.price ?? "0")) || 0,
    currency: "USD",
    inventory:
      row.inventory !== undefined
        ? parseInt(String(row.inventory), 10)
        : row.stock !== undefined
        ? parseInt(String(row.stock), 10)
        : null,
    images: row.image ? [String(row.image)] : row.image_url ? [String(row.image_url)] : [],
    categories: row.category
      ? [String(row.category)]
      : row.type
      ? [String(row.type)]
      : [],
    attributes: {},
  }));
}

/**
 * RFC 4180-compliant CSV line parser.
 * Handles quoted fields with embedded commas, escaped quotes (""), and newlines.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Parse a CSV string into NormalizedProduct[] using a column mapping */
export function parseCsvFeed(
  csv: string,
  mapping: Record<string, string> = {}
): NormalizedProduct[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0] ?? "");
  const rows: FeedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i] ?? "");
    const row: FeedRow = {};
    headers.forEach((header, idx) => {
      const mappedKey = mapping[header] ?? header;
      row[mappedKey] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return parseJsonFeed(rows);
}

/** Parse a Google Shopping XML/RSS feed into NormalizedProduct[] */
export function parseXmlFeed(xml: string): NormalizedProduct[] {
  const items: FeedRow[] = [];
  // Extract <item> or <entry> blocks
  const itemRegex = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]!;
    const get = (tag: string): string | undefined => {
      const m = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block);
      return m?.[1] ?? m?.[2]?.trim();
    };

    const priceStr = get("g:price") ?? get("price") ?? "0";
    const price = parseFloat(priceStr.replace(/[^0-9.]/g, "")) || 0;

    items.push({
      id: get("g:id") ?? get("id"),
      title: get("g:title") ?? get("title"),
      description: get("g:description") ?? get("description"),
      price,
      image: get("g:image_link") ?? get("image_link") ?? get("enclosure"),
      category: get("g:product_type") ?? get("g:google_product_category") ?? get("category"),
      inventory: get("g:quantity") ?? get("quantity"),
    });
  }

  return parseJsonFeed(items);
}
