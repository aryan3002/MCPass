import { createHash } from "crypto";
import { getTenantBySlug } from "@mcpaas/kernel-datastore";
import type { Tenant } from "@mcpaas/kernel-types";

export interface AuthResult {
  authenticated: boolean;
  tenant?: Tenant;
  error?: string;
}

/**
 * Validate an API key against the tenant's stored hash.
 * API key is passed as Bearer token in Authorization header.
 */
export async function validateApiKey(
  tenantSlug: string,
  apiKey: string
): Promise<AuthResult> {
  if (!apiKey) {
    return { authenticated: false, error: "Missing API key" };
  }

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) {
    return { authenticated: false, error: "Tenant not found" };
  }

  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  if (keyHash !== tenant.apiKeyHash) {
    return { authenticated: false, error: "Invalid API key" };
  }

  return { authenticated: true, tenant };
}

/**
 * Extract Bearer token from Authorization header.
 */
export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1] ?? null;
}
