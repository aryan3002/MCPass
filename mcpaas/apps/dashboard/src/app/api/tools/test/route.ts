import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentTenant } from "@/lib/supabase";

// POST /api/tools/test — proxy a tool call to the MCP server for testing
export async function POST(request: NextRequest) {
  const tenant = await getCurrentTenant();
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { toolName, input, apiKey } = body as {
    toolName: string;
    input: Record<string, unknown>;
    apiKey: string;
  };

  if (!toolName || !apiKey) {
    return NextResponse.json({ error: "toolName and apiKey are required" }, { status: 400 });
  }

  const mcpServerUrl = process.env.MCP_SERVER_URL ?? "https://mcp.mcpaas.dev";
  const mcpEndpoint = `${mcpServerUrl}/api/${tenant.slug}/mcp`;

  // MCP SDK requires both Accept types
  const MCP_HEADERS = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  // MCP server returns SSE format: "event: message\ndata: {...}\n\n"
  // Parse the JSON payload from the data line
  function parseSseResponse(text: string): unknown {
    const match = text.match(/^data:\s*({.+})/m);
    if (match) {
      try { return JSON.parse(match[1]); } catch {}
    }
    return text;
  }

  try {
    // Step 1: Initialize session + list tools
    const initRes = await fetch(mcpEndpoint, {
      method: "POST",
      headers: { ...MCP_HEADERS, Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "mcpaas-playground", version: "1.0.0" },
        },
      }),
    });

    if (!initRes.ok) {
      const text = await initRes.text();
      return NextResponse.json(
        { error: `MCP server error: ${initRes.status} ${text}` },
        { status: 502 }
      );
    }

    const sessionId = initRes.headers.get("mcp-session-id");
    const initData = parseSseResponse(await initRes.text());

    // Step 2: Send initialized notification
    await fetch(mcpEndpoint, {
      method: "POST",
      headers: {
        ...MCP_HEADERS,
        Authorization: `Bearer ${apiKey}`,
        ...(sessionId ? { "mcp-session-id": sessionId } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    });

    // Step 3: Call the tool
    const callRes = await fetch(mcpEndpoint, {
      method: "POST",
      headers: {
        ...MCP_HEADERS,
        Authorization: `Bearer ${apiKey}`,
        ...(sessionId ? { "mcp-session-id": sessionId } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: input ?? {},
        },
      }),
    });

    const callData = parseSseResponse(await callRes.text());

    // Step 4: Cleanup session
    if (sessionId) {
      fetch(mcpEndpoint, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "mcp-session-id": sessionId,
        },
      }).catch(() => {}); // fire and forget
    }

    return NextResponse.json({
      initResponse: initData,
      toolResponse: callData,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to reach MCP server: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 502 }
    );
  }
}
