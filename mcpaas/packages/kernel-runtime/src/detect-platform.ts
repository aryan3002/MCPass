import type { AgentPlatform } from "@mcpaas/kernel-types";

/**
 * Detect the agent platform from HTTP request headers.
 * Used for telemetry and per-platform analytics.
 */
export function detectAgentPlatform(headers: Record<string, string | undefined>): AgentPlatform {
  const userAgent = (headers["user-agent"] ?? "").toLowerCase();
  const origin = (headers["origin"] ?? "").toLowerCase();
  const referer = (headers["referer"] ?? "").toLowerCase();

  // OpenAI Responses API sends requests from their infrastructure
  if (userAgent.includes("openai") || origin.includes("openai") || origin.includes("chatgpt")) {
    return "chatgpt";
  }

  // Claude MCP client
  if (userAgent.includes("claude") || userAgent.includes("anthropic") || origin.includes("anthropic")) {
    return "claude";
  }

  // Google Gemini
  if (userAgent.includes("google") || userAgent.includes("gemini") || origin.includes("google")) {
    return "gemini";
  }

  // Browser-based agent (WebMCP)
  if (userAgent.includes("chrome") || userAgent.includes("mozilla")) {
    return "browser";
  }

  return "unknown";
}
