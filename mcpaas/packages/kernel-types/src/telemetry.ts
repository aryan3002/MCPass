import type { AgentPlatform } from "./tool.js";

export type ToolCallStatus = "success" | "error" | "policy_blocked";

export interface ToolCallEvent {
  id?: string;
  tenantId: string;
  toolName: string;
  inputParams: Record<string, unknown>;
  output?: unknown;
  resultCount?: number;
  status: ToolCallStatus;
  errorMessage?: string;
  latencyMs: number;
  agentPlatform: AgentPlatform;
  sessionId?: string;
  userIp?: string;
  createdAt?: Date;
}

export interface TelemetryStats {
  totalCalls: number;
  callsToday: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
  topTools: Array<{ toolName: string; count: number }>;
}
