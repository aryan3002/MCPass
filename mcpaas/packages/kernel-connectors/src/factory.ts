import type { MCPaaSConnector } from "./types.js";
import { ShopifyConnector } from "./shopify.js";
import { FeedConnector } from "./feed.js";
import { MongoDBConnector } from "./mongodb.js";

/**
 * Factory function — creates and authenticates a connector from tenant config.
 * Returns null if the connector type is unknown or credentials are missing.
 */
export async function connectorFactory(
  connectorType: string,
  credentials: Record<string, string>
): Promise<MCPaaSConnector | null> {
  let connector: MCPaaSConnector;

  switch (connectorType) {
    case "shopify":
      connector = new ShopifyConnector();
      break;
    case "feed":
      connector = new FeedConnector();
      break;
    case "mongodb":
      connector = new MongoDBConnector();
      break;
    default:
      return null;
  }

  try {
    await connector.authenticate(credentials);
    return connector;
  } catch (err) {
    console.error(`[connectorFactory] Failed to auth connector "${connectorType}":`, err);
    return null;
  }
}
