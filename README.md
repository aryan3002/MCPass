# MCPaaS — Model Context Protocol as a Service

> **Hosted [MCP](https://www.anthropic.com/news/model-context-protocol) infrastructure for AI agents.** Plug your business into the agentic web in minutes — no MCP server to build, no SDK to learn, no infrastructure to run.

[![Built on MCP](https://img.shields.io/badge/Built%20on-Anthropic's%20MCP-blueviolet)](https://modelcontextprotocol.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![Status](https://img.shields.io/badge/status-MVP%20(not%20deployed%20publicly)-orange)]()

> **Status:** the MVP is feature-complete and runs locally (see the quickstart). It is not deployed publicly yet, so there is no hosted endpoint to try. The Dockerfile and Fly.io config are in the repo for when it goes live.

---

## What is this?

MCPaaS is a **multi-tenant MCP server platform** built to be hosted. The idea: a merchant signs up, plugs in a connector (Shopify, custom feed, etc.), and their business becomes queryable by every AI agent that speaks [Anthropic's Model Context Protocol](https://www.anthropic.com/news/model-context-protocol) — Claude, ChatGPT, Gemini, Cursor, and 200+ tools.

```
┌──────────────┐      MCP Protocol      ┌────────────────┐      Connector      ┌──────────────┐
│  AI Agent    │  ◄─────────────────►   │     MCPaaS     │  ◄──────────────►   │ Your Business│
│  (Claude,    │                        │ (multi-tenant  │                     │  (Shopify,   │
│   ChatGPT,   │                        │   MCP server)  │                     │   feeds,     │
│   Gemini)    │                        │                │                     │   APIs)      │
└──────────────┘                        └────────────────┘                     └──────────────┘
```

---

## Highlights

- 🚀 **One-click MCP endpoint** for every tenant
- 🔌 **Pluggable connectors** — Shopify, Feed and CribLiv connectors built; framework for any backend
- 🤖 **Agent platform detection** — different routes for ChatGPT vs Claude vs Gemini vs browser
- 🛡 **Policy + telemetry pipeline** wrapping every tool call
- 🔐 **Multi-tenant** isolation at data, auth, and registry layers
- 📦 **Deploy-ready**: Dockerfile and Fly.io config included (not deployed publicly yet)

---

## Repo Layout

The full monorepo lives in [`mcpaas/`](./mcpaas) — see [`mcpaas/README.md`](./mcpaas/README.md) for architecture, quickstart, and deployment docs.

```
MCPass/
├── mcpaas/         ← Full pnpm + Turbo monorepo (apps + kernel packages)
│   ├── apps/
│   │   ├── mcp-server/    ← The MCP server
│   │   └── dashboard/     ← Merchant-facing Next.js UI
│   └── packages/
│       ├── kernel-types, kernel-auth, kernel-datastore,
│       │ kernel-runtime, kernel-policy, kernel-registry,
│       │ kernel-connectors, kernel-telemetry, ...
│       └── ...
├── Dockerfile      ← Container image
└── fly.toml        ← Fly.io deployment config (sjc region)
```

---

## Tech Stack

TypeScript · Node 20 · pnpm + Turborepo · Zod · Supabase · Next.js · [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) · Docker · Fly.io

---

## Why This Matters

Agentic commerce is no longer hypothetical. Stripe shipped the **Agentic Commerce Protocol** with OpenAI. Shopify rolled out agentic storefronts to millions of merchants. Block uses MCP for AI checkout flows. The question is no longer *whether* businesses need to be agent-accessible — it's *how fast they can become so*.

MCPaaS is the answer for the long tail. Enterprise merchants will build their own MCP servers. Everyone else needs a hosted one. That's the wedge.

---

## Companion Project

**Tokento** — Loyalty infrastructure layer for AI shopping agents (companion project). MCPaaS handles agent discovery and tool execution; Tokento handles the reward layer at agentic checkout. Together they cover both halves of the agentic-commerce stack.

---

## About

Built by **[Aryan Tripathi](https://linkedin.com/in/aryan-tripathi-9254a611b)** — CS Senior @ Arizona State (May 2026), 4+1 MS CS candidate (AI concentration). Open to internships and collaboration in AI infrastructure and agentic commerce.

📧 atripa38@asu.edu · 💻 [github.com/aryan3002](https://github.com/aryan3002)

---

## License

MIT
