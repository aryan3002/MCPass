/**
 * MCPaaS Connector Interface
 *
 * Every data source connector (Shopify, WooCommerce, CribLiv, Feed, Custom API)
 * implements this interface. The kernel uses connectors to:
 *   1. Fetch normalized data for tool handlers
 *   2. Know which capabilities are available for tool generation
 */

// ─── Normalized Commerce Schema ────────────────────────────────────────────

export interface NormalizedProduct {
  id: string;
  externalId: string;      // ID in the source system (Shopify product ID, etc.)
  title: string;
  description: string;
  price: number;
  currency: string;
  inventory: number | null;
  images: string[];
  categories: string[];
  attributes: Record<string, string | string[]>;
  url?: string;
  variants?: NormalizedVariant[];
}

export interface NormalizedVariant {
  id: string;
  title: string;
  price: number;
  inventory: number | null;
  attributes: Record<string, string>;
}

export interface InventoryStatus {
  available: boolean;
  quantity: number | null;
  availableFrom?: string;
}

export interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  currency: string;
  checkoutUrl?: string;
}

export interface SearchParams {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  attributes?: Record<string, string | string[]>;
  limit?: number;
  page?: number;
}

// ─── Connector Capability Flags ─────────────────────────────────────────────

export interface ConnectorCapabilities {
  // Ecommerce
  search: boolean;
  productDetails: boolean;
  inventory: boolean;
  cart: boolean;
  checkout: boolean;
  recommendations: boolean;
  // Rental
  propertySearch: boolean;
  propertyDetails: boolean;
  availability: boolean;
  visitScheduling: boolean;
  neighborhoodInfo: boolean;
  // Booking (future)
  slotSearch: boolean;
  bookAppointment: boolean;
}

export interface NormalizedListing {
  id: string;
  externalId: string;
  title: string;
  type: "apartment" | "pg" | "villa" | "studio" | string;
  bedrooms: number | null;
  rentMonthly: number;
  deposit: number | null;
  areaSqft: number | null;
  locality: string;
  city: string;
  address: string | null;
  amenities: string[];
  furnishing: string | null;
  availableFrom: string | null;
  isVerified: boolean;
  photos: string[];
  description: string | null;
  leaseDuration: string | null;
  preferredTenants: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
}

// ─── Connector Interface ────────────────────────────────────────────────────

export interface MCPaaSConnector {
  readonly type: string;
  readonly capabilities: ConnectorCapabilities;

  /** Validate credentials and establish connection. Throws if auth fails. */
  authenticate(credentials: Record<string, string>): Promise<void>;

  /** Quick health check. Returns true if the connection is working. */
  healthCheck(): Promise<{ ok: boolean; message?: string }>;

  // Commerce operations — each is optional based on capabilities

  searchProducts?(params: SearchParams): Promise<NormalizedProduct[]>;

  getProductById?(id: string): Promise<NormalizedProduct | null>;

  checkInventory?(productId: string, variantId?: string): Promise<InventoryStatus>;

  createCart?(items: CartItem[]): Promise<Cart>;

  addToCart?(cartId: string, item: CartItem): Promise<Cart>;

  getCheckoutUrl?(cartId: string): Promise<string>;

  /** Generic execute for connector-type tool definitions */
  execute(method: string, params: Record<string, unknown>): Promise<unknown>;
}

// ─── Base class helpers ──────────────────────────────────────────────────────

export abstract class BaseConnector implements MCPaaSConnector {
  abstract readonly type: string;
  abstract readonly capabilities: ConnectorCapabilities;

  abstract authenticate(credentials: Record<string, string>): Promise<void>;
  abstract healthCheck(): Promise<{ ok: boolean; message?: string }>;

  async execute(method: string, params: Record<string, unknown>): Promise<unknown> {
    const fn = (this as unknown as Record<string, unknown>)[method];
    if (typeof fn !== "function") {
      throw new Error(`Connector "${this.type}" does not support method "${method}"`);
    }
    return (fn as Function).call(this, params);
  }
}
