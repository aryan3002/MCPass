import { z } from "zod";

export const TenantPlanSchema = z.enum(["free", "starter", "growth", "enterprise"]);
export type TenantPlan = z.infer<typeof TenantPlanSchema>;

export const BusinessDomainSchema = z.enum(["rental", "ecommerce", "booking"]);
export type BusinessDomain = z.infer<typeof BusinessDomainSchema>;

export const ConnectorTypeSchema = z.enum([
  "cribliv",
  "shopify",
  "woocommerce",
  "feed",
  "custom-api",
  "manual",
  "mongodb",
]);
export type ConnectorType = z.infer<typeof ConnectorTypeSchema>;

export const TenantConfigSchema = z.object({
  maxToolCallsPerDay: z.number().default(1000),
  enabledSurfaces: z.array(z.enum(["mcp", "webmcp", "ucp", "rest"])).default(["mcp"]),
  customDomain: z.string().optional(),
  connectorType: ConnectorTypeSchema.optional(),
  connectorConfig: z.record(z.unknown()).optional(),
  businessDomain: BusinessDomainSchema.optional(),
  timezone: z.string().optional(),
  notificationWebhookUrl: z.string().optional(),
});
export type TenantConfig = z.infer<typeof TenantConfigSchema>;

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  apiKeyHash: string;
  plan: TenantPlan;
  config: TenantConfig;
  createdAt: Date;
  updatedAt: Date;
}
