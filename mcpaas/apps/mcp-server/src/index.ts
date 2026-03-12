import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerTenantTools } from "./tools.js";
import { generateWebMCPScript, generateUCPProfile } from "./webmcp.js";
import { validateApiKey, extractBearerToken } from "@mcpaas/kernel-auth";
import { getTenantBySlug } from "@mcpaas/kernel-datastore";
import { detectAgentPlatform } from "@mcpaas/kernel-runtime";
import type { Tenant } from "@mcpaas/kernel-types";

type HonoVariables = { tenant: Tenant };
const app = new Hono<{ Variables: HonoVariables }>();

// Middleware
app.use("*", logger());
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "mcp-session-id"],
  exposeHeaders: ["mcp-session-id"],
}));

// Health check
app.get("/health", (c) => c.json({ status: "ok", service: "mcpaas-mcp-server" }));

// Store active transports keyed by sessionId
// Each session is tied to one tenant's MCP server instance.
interface SessionEntry {
  transport: WebStandardStreamableHTTPServerTransport;
  createdAt: number;
}
const transports = new Map<string, SessionEntry>();

// Session TTL: clean up stale sessions every 5 minutes (30 min TTL)
const SESSION_TTL_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, entry] of transports) {
    if (now - entry.createdAt > SESSION_TTL_MS) {
      entry.transport.close().catch(() => {});
      transports.delete(sessionId);
    }
  }
}, 5 * 60 * 1000);

async function getOrCreateTransport(tenant: Tenant, sessionId: string | undefined) {
  // Reuse existing transport for this session
  if (sessionId) {
    const existing = transports.get(sessionId);
    if (existing) return existing.transport;
  }

  // Create a new MCP server + transport for this tenant
  const mcpServer = new McpServer({
    name: `MCPaaS - ${tenant.name}`,
    version: "0.1.0",
  });

  await registerTenantTools(mcpServer, tenant);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (newSessionId) => {
      transports.set(newSessionId, { transport, createdAt: Date.now() });
    },
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      transports.delete(transport.sessionId);
    }
  };

  await mcpServer.connect(transport);
  return transport;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth middleware: validates Bearer API key for /api/:tenantSlug/* routes
// ─────────────────────────────────────────────────────────────────────────────
async function authMiddleware(c: import("hono").Context<{ Variables: HonoVariables }>, next: () => Promise<void>) {
  const tenantSlug = c.req.param("tenantSlug") ?? "";
  const apiKey = extractBearerToken(c.req.header("Authorization"));

  if (!apiKey) {
    return c.json({ error: "Missing Authorization header (expected: Bearer <api-key>)" }, 401);
  }

  const authResult = await validateApiKey(tenantSlug, apiKey);

  if (!authResult.authenticated || !authResult.tenant) {
    return c.json({ error: authResult.error ?? "Unauthorized" }, 401);
  }

  // Store resolved tenant in context for downstream handlers
  c.set("tenant", authResult.tenant);
  await next();
}

// ─────────────────────────────────────────────────────────────────────────────
// MCP routes: /api/:tenantSlug/mcp
// ─────────────────────────────────────────────────────────────────────────────

// POST — tool calls (initialize session + handle requests)
app.post("/api/:tenantSlug/mcp", authMiddleware, async (c) => {
  try {
    const tenant = c.get("tenant");
    const sessionId = c.req.header("mcp-session-id");

    // Detect agent platform from request headers for telemetry
    const platform = detectAgentPlatform({
      "user-agent": c.req.header("user-agent"),
      origin: c.req.header("origin"),
      referer: c.req.header("referer"),
    });
    console.log(`[mcpaas] Request from platform: ${platform}`);

    const transport = await getOrCreateTransport(tenant, sessionId);
    const response = await transport.handleRequest(c.req.raw);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});

// GET — SSE stream for server notifications
app.get("/api/:tenantSlug/mcp", authMiddleware, async (c) => {
  const sessionId = c.req.header("mcp-session-id");
  if (!sessionId) {
    return c.json({ error: "Missing mcp-session-id header" }, 400);
  }

  const entry = transports.get(sessionId);
  if (!entry) {
    return c.json({ error: "Session not found. Send a POST first to initialize." }, 404);
  }

  const response = await entry.transport.handleRequest(c.req.raw);
  return response;
});

// DELETE — close session
app.delete("/api/:tenantSlug/mcp", authMiddleware, async (c) => {
  const sessionId = c.req.header("mcp-session-id");
  if (sessionId) {
    const entry = transports.get(sessionId);
    if (entry) {
      await entry.transport.close();
      transports.delete(sessionId);
    }
  }
  return c.json({ status: "closed" });
});

// ─────────────────────────────────────────────────────────────────────────────
// WebMCP script — public, no auth required
// GET /api/:tenantSlug/webmcp.js
// ─────────────────────────────────────────────────────────────────────────────
const mcpServerUrl = process.env.MCP_SERVER_URL ?? "http://localhost:3000";

app.get("/api/:tenantSlug/webmcp.js", async (c) => {
  const tenantSlug = c.req.param("tenantSlug");
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return c.json({ error: "Tenant not found" }, 404);

  const script = await generateWebMCPScript(tenant, mcpServerUrl);
  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=300", // 5 min cache
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UCP profile — public, no auth required
// GET /api/:tenantSlug/ucp
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/:tenantSlug/ucp", async (c) => {
  const tenantSlug = c.req.param("tenantSlug");
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return c.json({ error: "Tenant not found" }, 404);

  const profile = await generateUCPProfile(tenant, mcpServerUrl);
  return c.json(profile);
});

// ─────────────────────────────────────────────────────────────────────────────
// Backwards-compat redirect: /mcp → explain the new URL format
// ─────────────────────────────────────────────────────────────────────────────
app.all("/mcp", (c) =>
  c.json(
    {
      error: "This endpoint has moved. Use /api/:tenantSlug/mcp",
      example: "POST /api/cribliv/mcp with Authorization: Bearer <api-key>",
    },
    410
  )
);

// Start server
const port = parseInt(process.env.PORT ?? "3000", 10);
console.log(`\nMCPaaS MCP Server starting on port ${port}...`);
console.log(`  Health:  http://localhost:${port}/health`);
console.log(`  MCP:     http://localhost:${port}/api/:tenantSlug/mcp`);
console.log(`  Example: http://localhost:${port}/api/cribliv/mcp\n`);

serve({ fetch: app.fetch, port });
