# MCPaaS — MCP-as-a-Service

> **Hosted Model Context Protocol infrastructure for AI agents.** Plug your business into the agentic web in minutes — no MCP server to build, no SDK to learn, no infrastructure to run.

[![Built on MCP](https://img.shields.io/badge/Built%20on-Anthropic's%20MCP-blueviolet)](https://modelcontextprotocol.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![Deployed on Fly.io](https://img.shields.io/badge/Deployed-Fly.io-purple)](https://fly.io/)
[![Status](https://img.shields.io/badge/status-active-success)]()

---

## The Problem

[Anthropic's Model Context Protocol](https://www.anthropic.com/news/model-context-protocol) is the de facto standard for connecting AI agents (Claude, ChatGPT, Gemini, Cursor) to external tools and data. As of 2026, OpenAI, Google, Microsoft, Block, and 200+ tools have adopted it.

But to expose your business to agents via MCP, you need to:
- Spin up and host an MCP server
- Write tool definitions in MCP's schema
- Handle multi-tenancy, auth, rate-limiting, telemetry
- Maintain a session layer with TTLs
- Keep up with protocol changes

Most teams don't have the bandwidth. **That's the gap MCPaaS fills.**

---

## What It Does

MCPaaS is a multi-tenant, cloud-hosted MCP server platform. You plug in a connector (Shopify, custom feed, CribLiv, anything), get a live MCP endpoint, and any agent that speaks MCP can now query your business.

```
┌──────────────┐      MCP Protocol      ┌────────────────┐      Connector      ┌──────────────┐
│  AI Agent    │  ◄─────────────────►   │     MCPaaS     │  ◄──────────────►   │ Your Business│
│  (Claude,    │                        │ (multi-tenant  │                     │  (Shopify,   │
│   ChatGPT,   │                        │   MCP server)  │                     │   feeds,     │
│   Gemini)    │                        │                │                     │   APIs)      │
└──────────────┘                        └────────────────┘                     └──────────────┘
```

**Outcome:** A merchant signs up, drops in a Shopify API key, and within a minute their product catalog is queryable by every AI agent on the open web.

---

## Core Capabilities

| Feature | What it gives you |
|---|---|
| **One-click MCP endpoint** | Tenants get a hosted MCP URL the moment they sign up |
| **Pluggable connectors** | Shopify, Feed, CribLiv — drop in new ones via the kernel-connectors interface |
| **Dynamic tool generation** | Tools auto-generated from connector capabilities, no hand-writing schemas |
| **Agent platform detection** | Routes requests differently for ChatGPT vs Claude vs Gemini vs browser |
| **Policy + telemetry pipeline** | Every tool call wrapped in an executor — policies enforce limits, telemetry logs the call |
| **Session lifecycle management** | 30-min TTL with periodic cleanup — no memory leaks under sustained load |
| **Multi-tenant by design** | Tenant isolation at the data, auth, and tool registry layers |
| **API key auth + rotation** | Two-step regeneration flow with reveal-once UX |

---

## Architecture

```
mcpaas/
├── apps/
│   ├── mcp-server/        ← The live MCP server (Fly.io-deployed)
│   └── dashboard/         ← Merchant-facing Next.js UI for connector setup, key mgmt
└── packages/
    ├── kernel-types/      ← Shared TypeScript contracts
    ├── kernel-auth/       ← API key auth, key rotation
    ├── kernel-datastore/  ← Tenant + tool-definition data layer (Supabase)
    ├── kernel-registry/   ← Tenant registry, tool registry
    ├── kernel-runtime/    ← Executor pipeline, agent platform detection
    ├── kernel-policy/     ← Rate limits, permission policies
    ├── kernel-connectors/ ← Pluggable connector framework
    ├── kernel-telemetry/  ← Observability
    ├── connectors/        ← Shopify, Feed connectors
    ├── tools/             ← Tool definitions (e.g. CribLiv POC tools)
    └── db/                ← Supabase migrations
```

### Request Lifecycle

```
Agent request
     ↓
[mcp-server] accepts MCP protocol message → detects agent platform → resolves tenant
     ↓
[kernel-registry] loads tenant tools (or auto-generates from connector on first run)
     ↓
[kernel-runtime] dispatches to handler — pure CribLiv tools OR connector-backed live tools
     ↓
[kernel-policy] enforces rate limits, permissions
     ↓
[kernel-connectors] makes the actual call to Shopify/Feed/etc.
     ↓
[kernel-telemetry] logs the entire trace
     ↓
Response → Agent
```

---

## Tech Stack

- **Language:** TypeScript (strict)
- **Runtime:** Node 20
- **Monorepo:** pnpm workspaces + Turborepo
- **Validation:** Zod
- **Database:** Supabase (Postgres)
- **MCP SDK:** [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)
- **Dashboard:** Next.js (App Router) + React Server Components
- **Deployment:** Docker → Fly.io (`sjc` region)
- **Auth:** API keys with rotation

---

## Quickstart (Local Dev)

```bash
# Clone and install
git clone https://github.com/aryan3002/MCPass.git
cd MCPass/mcpaas
pnpm install

# Set up env
cp apps/dashboard/.env.example apps/dashboard/.env.local
cp apps/mcp-server/.env.example apps/mcp-server/.env

# Build kernel packages in dependency order
pnpm build

# Run dashboard + MCP server
pnpm dev
```

- Dashboard → `http://localhost:3001`
- MCP server → `http://localhost:3000/mcp/<tenant-slug>`

Point any MCP-compatible agent (Claude Desktop, Cursor, etc.) at the MCP URL.

---

## Production Deployment

```bash
# Build & deploy to Fly.io
fly deploy
```

The included `Dockerfile` builds all kernel packages in correct dependency order and starts the MCP server. The `fly.toml` is pre-configured for the `sjc` region with auto-stop/start machines.

---

## Adding a New Connector

The kernel-connectors interface makes adding a new business integration trivial:

```typescript
// packages/connectors/your-connector/index.ts
export const yourConnector: Connector = {
  type: "your-connector",
  async generateTools(credentials) { /* ... */ },
  async invoke(toolName, args, credentials) { /* ... */ }
};
```

Then register it in `kernel-connectors/factory.ts`. MCPaaS handles the rest — tool registration, executor wrapping, policy enforcement, telemetry.

---

## Why This Matters

**Agentic commerce is here.** Stripe shipped the Agentic Commerce Protocol with OpenAI. Shopify rolled out agentic storefronts to millions of merchants. Block uses MCP for AI checkout flows. The question is no longer *whether* businesses need to be agent-accessible — it's *how fast they can become so*.

MCPaaS is the answer for the long tail. Big merchants will build their own MCP servers. Everyone else needs a hosted one. That's the wedge.

---

## Related Work

- **Tokento** — Loyalty layer for AI shopping agents (companion project, working with PayPal's Agentic Commerce team)
- **AgentPort** — The marketing/demo site for MCPaaS

---

## About the Author

**Aryan Tripathi** — CS Senior at Arizona State University (May 2026), 4+1 MS CS candidate (AI concentration). Building in the agentic commerce + AI infrastructure space.

- 🔗 [LinkedIn](https://linkedin.com/in/aryan-tripathi-9254a611b)
- 💻 [GitHub](https://github.com/aryan3002)
- 📧 atripa38@asu.edu

---

## License

MIT
