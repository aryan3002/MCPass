import { z } from "zod";

export interface ToolDefinition {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  inputSchema: z.ZodType;
  version: number;
  isActive: boolean;
  config: ToolConfig;
}

export interface ToolConfig {
  rateLimit?: {
    maxCallsPerMinute: number;
  };
  cacheTtlSeconds?: number;
  requireConfirmation?: boolean;
}

export interface ToolCallRequest {
  tenantId: string;
  toolName: string;
  input: Record<string, unknown>;
  agentPlatform: AgentPlatform;
  sessionId?: string;
}

export interface ToolCallResponse {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    latencyMs: number;
    resultCount?: number;
  };
}

export type AgentPlatform = "chatgpt" | "claude" | "gemini" | "browser" | "unknown";

export type ToolHandler = (input: Record<string, unknown>) => Promise<ToolCallResponse>;

/**
 * A tool definition stored in the database (DB-driven, not code-defined).
 * Used for dynamic tool registration for multi-tenant merchants.
 */
export interface DBToolDefinition {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema object
  handlerType: "connector" | "webhook" | "static";
  handlerConfig: Record<string, unknown> | null;
  isEnabled: boolean;
  version: number;
  createdAt: Date;
}
