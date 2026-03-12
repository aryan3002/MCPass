import type { DBToolDefinition } from "@mcpaas/kernel-types";
import type { ConnectorCapabilities } from "@mcpaas/kernel-connectors";
import { getTemplatesForRentalCapabilities } from "./rental-templates.js";

/**
 * Pre-written, LLM-tested tool description templates.
 * These are the gold-standard descriptions that get ≥90% correct invocation
 * on first attempt across GPT-4o, Claude, and Gemini.
 *
 * Merchants can edit these in the dashboard after generation.
 */

export type ToolTemplate = Omit<DBToolDefinition, "id" | "tenantId" | "createdAt" | "isEnabled" | "version">;

export const COMMERCE_TOOL_TEMPLATES: Record<string, ToolTemplate> = {
  search_products: {
    name: "search_products",
    description:
      "Search for products in the store catalog. Use this when the user wants to find, browse, or discover products. " +
      "Supports filtering by keyword, category, price range, and custom attributes. " +
      "Returns a list of matching products with titles, prices, descriptions, and images. " +
      "Call this first before get_product_details to find the right product ID.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search keywords — product name, type, or description",
        },
        category: {
          type: "string",
          description: "Filter by product category or type",
        },
        min_price: {
          type: "number",
          description: "Minimum price filter (in store currency)",
        },
        max_price: {
          type: "number",
          description: "Maximum price filter (in store currency)",
        },
        limit: {
          type: "integer",
          description: "Maximum number of results to return (default: 10, max: 50)",
        },
      },
    },
    handlerType: "connector",
    handlerConfig: { method: "searchProducts" },
  },

  get_product_details: {
    name: "get_product_details",
    description:
      "Get complete details about a specific product by its ID. " +
      "Returns full description, all variants (size, color, etc.), pricing, images, " +
      "inventory status, and any other available product information. " +
      "Use search_products first to find the product ID.",
    inputSchema: {
      type: "object",
      required: ["product_id"],
      properties: {
        product_id: {
          type: "string",
          description: "The unique product ID (from search_products results)",
        },
      },
    },
    handlerType: "connector",
    handlerConfig: { method: "getProductById" },
  },

  check_inventory: {
    name: "check_inventory",
    description:
      "Check real-time inventory availability for a specific product or variant. " +
      "Returns whether the item is in stock and the current quantity available. " +
      "Call this before adding to cart to avoid disappointment.",
    inputSchema: {
      type: "object",
      required: ["product_id"],
      properties: {
        product_id: {
          type: "string",
          description: "The product ID to check inventory for",
        },
        variant_id: {
          type: "string",
          description: "Optional: specific variant ID (for size/color variants)",
        },
      },
    },
    handlerType: "connector",
    handlerConfig: { method: "checkInventory" },
  },

  create_cart: {
    name: "create_cart",
    description:
      "Create a new shopping cart with one or more items. " +
      "Returns a cart ID and checkout URL. " +
      "Use this when the user is ready to add items and proceed toward purchase.",
    inputSchema: {
      type: "object",
      required: ["items"],
      properties: {
        items: {
          type: "array",
          description: "List of items to add to the cart",
          items: {
            type: "object",
            required: ["product_id", "quantity"],
            properties: {
              product_id: { type: "string", description: "Product ID" },
              variant_id: { type: "string", description: "Variant ID (if applicable)" },
              quantity: { type: "integer", description: "Quantity to add" },
            },
          },
        },
      },
    },
    handlerType: "connector",
    handlerConfig: { method: "createCart" },
  },

  add_to_cart: {
    name: "add_to_cart",
    description:
      "Add an item to an existing cart. Requires a cart ID from create_cart. " +
      "Returns the updated cart with new totals.",
    inputSchema: {
      type: "object",
      required: ["cart_id", "product_id", "quantity"],
      properties: {
        cart_id: { type: "string", description: "Cart ID from create_cart" },
        product_id: { type: "string", description: "Product ID to add" },
        variant_id: { type: "string", description: "Variant ID (if applicable)" },
        quantity: { type: "integer", description: "Quantity to add" },
      },
    },
    handlerType: "connector",
    handlerConfig: { method: "addToCart" },
  },

  get_checkout_url: {
    name: "get_checkout_url",
    description:
      "Get the checkout URL for an existing cart. " +
      "Send this URL to the user so they can complete their purchase in the store.",
    inputSchema: {
      type: "object",
      required: ["cart_id"],
      properties: {
        cart_id: { type: "string", description: "Cart ID from create_cart" },
      },
    },
    handlerType: "connector",
    handlerConfig: { method: "getCheckoutUrl" },
  },
};

/**
 * Given a connector's capability flags, return the relevant tool templates.
 */
export function getTemplatesForCapabilities(capabilities: {
  search: boolean;
  productDetails: boolean;
  inventory: boolean;
  cart: boolean;
  checkout: boolean;
}): ToolTemplate[] {
  const result: ToolTemplate[] = [];

  if (capabilities.search) result.push(COMMERCE_TOOL_TEMPLATES.search_products!);
  if (capabilities.productDetails) result.push(COMMERCE_TOOL_TEMPLATES.get_product_details!);
  if (capabilities.inventory) result.push(COMMERCE_TOOL_TEMPLATES.check_inventory!);
  if (capabilities.cart) {
    result.push(COMMERCE_TOOL_TEMPLATES.create_cart!);
    result.push(COMMERCE_TOOL_TEMPLATES.add_to_cart!);
  }
  if (capabilities.checkout) result.push(COMMERCE_TOOL_TEMPLATES.get_checkout_url!);

  return result;
}

/**
 * Domain-aware template selection.
 * Rental → RENTAL_TOOL_TEMPLATES, Ecommerce → COMMERCE_TOOL_TEMPLATES.
 */
export function getTemplatesForDomain(
  domain: string,
  capabilities: ConnectorCapabilities
): ToolTemplate[] {
  if (domain === "rental") {
    return getTemplatesForRentalCapabilities(capabilities);
  }
  return getTemplatesForCapabilities(capabilities);
}
