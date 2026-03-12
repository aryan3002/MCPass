import {
  BaseConnector,
  type ConnectorCapabilities,
  type NormalizedProduct,
  type NormalizedVariant,
  type InventoryStatus,
  type Cart,
  type CartItem,
  type SearchParams,
} from "./types.js";

/**
 * Shopify Connector — uses Shopify Admin REST API
 *
 * Credentials required:
 *   shopDomain:   e.g. "mystore.myshopify.com"
 *   accessToken:  Shopify Admin API access token (from OAuth or private app)
 *
 * Normalizes Shopify products/carts → MCPaaS commerce schema.
 */
export class ShopifyConnector extends BaseConnector {
  readonly type = "shopify";
  readonly capabilities: ConnectorCapabilities = {
    search: true,
    productDetails: true,
    inventory: true,
    cart: true,
    checkout: true,
    recommendations: false,
    propertySearch: false,
    propertyDetails: false,
    availability: false,
    visitScheduling: false,
    neighborhoodInfo: false,
    slotSearch: false,
    bookAppointment: false,
  };

  private shopDomain = "";
  private accessToken = "";
  private storefrontAccessToken = "";
  private currency = "USD";
  private apiVersion = "2024-10";

  async authenticate(credentials: Record<string, string>): Promise<void> {
    const { shopDomain, accessToken, storefrontAccessToken } = credentials;
    if (!shopDomain || !accessToken) {
      throw new Error("Shopify connector requires shopDomain and accessToken");
    }
    this.shopDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    this.accessToken = accessToken;
    this.storefrontAccessToken = storefrontAccessToken || accessToken;

    // Fetch shop currency
    try {
      const res = await this.adminFetch("shop.json");
      if (res.ok) {
        const { shop } = await res.json() as { shop: { currency: string } };
        if (shop?.currency) this.currency = shop.currency;
      }
    } catch {
      // Keep default USD if fetch fails
    }
  }

  async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await this.adminFetch("shop.json");
      if (!res.ok) return { ok: false, message: `Shopify returned ${res.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  async searchProducts(params: SearchParams): Promise<NormalizedProduct[]> {
    const qs = new URLSearchParams();
    if (params.query) qs.set("title", params.query);
    if (params.limit) qs.set("limit", String(Math.min(params.limit, 250)));
    if (params.category) qs.set("product_type", params.category);

    const res = await this.adminFetch(`products.json?${qs}`);
    if (!res.ok) throw new Error(`Shopify product search failed: ${res.status}`);

    const { products } = await res.json() as { products: ShopifyProduct[] };

    // Apply price filter client-side (Shopify doesn't support price range in REST)
    let filtered = products;
    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      filtered = products.filter((p) => {
        const price = parseFloat(p.variants[0]?.price ?? "0");
        if (params.minPrice !== undefined && price < params.minPrice) return false;
        if (params.maxPrice !== undefined && price > params.maxPrice) return false;
        return true;
      });
    }

    return filtered.map((p) => normalizeProduct(p, this.currency));
  }

  async getProductById(id: string): Promise<NormalizedProduct | null> {
    const res = await this.adminFetch(`products/${id}.json`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Shopify product fetch failed: ${res.status}`);
    const { product } = await res.json() as { product: ShopifyProduct };
    return normalizeProduct(product, this.currency);
  }

  async checkInventory(productId: string, variantId?: string): Promise<InventoryStatus> {
    const res = await this.adminFetch(`products/${productId}.json`);
    if (!res.ok) throw new Error(`Shopify inventory check failed: ${res.status}`);
    const { product } = await res.json() as { product: ShopifyProduct };

    const variant = variantId
      ? product.variants.find((v) => String(v.id) === variantId)
      : product.variants[0];

    if (!variant) return { available: false, quantity: 0 };

    return {
      available: variant.available,
      quantity: variant.inventory_quantity,
    };
  }

  async createCart(items: CartItem[]): Promise<Cart> {
    // Shopify Storefront API creates carts — use the Storefront API
    const lines = items.map((item) => ({
      merchandiseId: `gid://shopify/ProductVariant/${item.variantId ?? item.productId}`,
      quantity: item.quantity,
    }));

    const query = `
      mutation cartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
            lines(first: 10) {
              edges { node { merchandise { ... on ProductVariant { id } } quantity } }
            }
            cost { subtotalAmount { amount currencyCode } }
          }
        }
      }
    `;

    const res = await this.storefrontFetch({ query, variables: { input: { lines } } });
    const json = await res.json() as { data: { cartCreate: { cart: ShopifyCart } } };
    const cart = json.data.cartCreate.cart;

    return {
      id: cart.id,
      items,
      subtotal: parseFloat(cart.cost?.subtotalAmount?.amount ?? "0"),
      currency: cart.cost?.subtotalAmount?.currencyCode ?? "USD",
      checkoutUrl: cart.checkoutUrl,
    };
  }

  async addToCart(cartId: string, item: CartItem): Promise<Cart> {
    const query = `
      mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart {
            id checkoutUrl
            cost { subtotalAmount { amount currencyCode } }
          }
        }
      }
    `;

    const lines = [{
      merchandiseId: `gid://shopify/ProductVariant/${item.variantId ?? item.productId}`,
      quantity: item.quantity,
    }];

    const res = await this.storefrontFetch({ query, variables: { cartId, lines } });
    const json = await res.json() as { data: { cartLinesAdd: { cart: ShopifyCart } } };
    const cart = json.data.cartLinesAdd.cart;

    return {
      id: cart.id,
      items: [item],
      subtotal: parseFloat(cart.cost?.subtotalAmount?.amount ?? "0"),
      currency: cart.cost?.subtotalAmount?.currencyCode ?? "USD",
      checkoutUrl: cart.checkoutUrl,
    };
  }

  async getCheckoutUrl(cartId: string): Promise<string> {
    const query = `query getCart($id: ID!) { cart(id: $id) { checkoutUrl } }`;
    const res = await this.storefrontFetch({ query, variables: { id: cartId } });
    const json = await res.json() as { data: { cart: { checkoutUrl: string } } };
    return json.data.cart.checkoutUrl;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private get baseUrl() {
    return `https://${this.shopDomain}/admin/api/${this.apiVersion}`;
  }

  private async adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
    return fetch(`${this.baseUrl}/${path}`, {
      ...options,
      headers: {
        "X-Shopify-Access-Token": this.accessToken,
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> ?? {}),
      },
    });
  }

  private async storefrontFetch(body: unknown): Promise<Response> {
    const res = await fetch(`https://${this.shopDomain}/api/${this.apiVersion}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": this.storefrontAccessToken,
      },
      body: JSON.stringify(body),
    });

    // Clone response to check for GraphQL errors while still returning it
    const cloned = res.clone();
    try {
      const json = await cloned.json() as { errors?: Array<{ message: string }> };
      if (json.errors && json.errors.length > 0) {
        throw new Error(`Shopify GraphQL error: ${json.errors[0]!.message}`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Shopify GraphQL")) throw err;
      // Ignore JSON parse errors — let caller handle
    }

    return res;
  }
}

// ── Shopify API types ────────────────────────────────────────────────────────

interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  product_type: string;
  images: { src: string }[];
  variants: ShopifyVariant[];
  tags: string;
}

interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  available: boolean;
  inventory_quantity: number;
  option1?: string;
  option2?: string;
  option3?: string;
}

interface ShopifyCart {
  id: string;
  checkoutUrl: string;
  cost?: { subtotalAmount?: { amount: string; currencyCode: string } };
}

function normalizeProduct(p: ShopifyProduct, currency: string): NormalizedProduct {
  const firstVariant = p.variants[0];
  const price = parseFloat(firstVariant?.price ?? "0");

  const variants: NormalizedVariant[] = p.variants.map((v) => ({
    id: String(v.id),
    title: v.title,
    price: parseFloat(v.price),
    inventory: v.inventory_quantity,
    attributes: {
      ...(v.option1 ? { option1: v.option1 } : {}),
      ...(v.option2 ? { option2: v.option2 } : {}),
      ...(v.option3 ? { option3: v.option3 } : {}),
    },
  }));

  return {
    id: String(p.id),
    externalId: String(p.id),
    title: p.title,
    description: p.body_html.replace(/<[^>]+>/g, " ").trim().slice(0, 500),
    price,
    currency,
    inventory: firstVariant?.inventory_quantity ?? null,
    images: p.images.map((img) => img.src),
    categories: p.product_type ? [p.product_type] : [],
    attributes: p.tags ? { tags: p.tags.split(", ") } : {},
    variants: variants.length > 1 ? variants : undefined,
  };
}
