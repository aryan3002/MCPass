/**
 * MCPaaS End-to-End Test Suite
 * Tests all 6 CribLiv tools via OpenAI Responses API + MCP
 *
 * Run: npx tsx scripts/test-e2e.ts
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const MCP_SERVER_URL = process.argv[2] || "http://localhost:3000/mcp";

if (!OPENAI_API_KEY || OPENAI_API_KEY === "your-openai-key") {
  console.error("❌  Set OPENAI_API_KEY in apps/mcp-server/.env");
  process.exit(1);
}

// ─── helpers ────────────────────────────────────────────────────────────────

function green(s: string) { return `\x1b[32m${s}\x1b[0m`; }
function red(s: string)   { return `\x1b[31m${s}\x1b[0m`; }
function bold(s: string)  { return `\x1b[1m${s}\x1b[0m`; }
function dim(s: string)   { return `\x1b[2m${s}\x1b[0m`; }

async function askOpenAI(prompt: string): Promise<{ reply: string; toolsCalled: string[]; toolInputs: Record<string, unknown>[] }> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      input: prompt,
      tools: [
        {
          type: "mcp",
          server_label: "cribliv",
          server_url: MCP_SERVER_URL,
          require_approval: "never",
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = await res.json() as any;

  // Extract tool calls and final text from output array
  const toolsCalled: string[] = [];
  const toolInputs: Record<string, unknown>[] = [];
  let reply = "";

  for (const item of data.output ?? []) {
    if (item.type === "mcp_call") {
      toolsCalled.push(item.name);
      toolInputs.push({ tool: item.name, input: item.arguments ?? item.input ?? {} });
    }
    if (item.type === "message") {
      for (const c of item.content ?? []) {
        if (c.type === "output_text") reply += c.text;
      }
    }
  }

  // Fallback for different response shapes
  if (!reply && data.output_text) reply = data.output_text;

  return { reply: reply.trim(), toolsCalled, toolInputs };
}

// ─── test cases ─────────────────────────────────────────────────────────────

const TESTS = [
  {
    tool: "search_properties",
    prompt: "Find me a 2BHK apartment in Lucknow under ₹10,000/month.",
  },
  {
    tool: "get_property_details",
    prompt:
      "Search for apartments in Lucknow, then get me the full details of the first result — include lease terms, description, and all amenities.",
  },
  {
    tool: "check_availability",
    prompt:
      "Search for apartments in Lucknow, then check if the first listing is still available.",
  },
  {
    tool: "compare_properties",
    prompt:
      "Search for PG accommodations in Greater Noida. You should find multiple results. Take the IDs of the first two and use the compare_properties tool to compare them side by side. Which is better value?",
  },
  {
    tool: "schedule_visit",
    prompt:
      "Search for apartments in Lucknow under ₹10,000, then schedule a visit for Aryan Tripathi (phone: 9876543210) on 2026-03-20 for the first result.",
  },
  {
    tool: "get_neighborhood_info",
    prompt:
      "I'm considering renting in Greater Noida near Knowledge Park. Tell me about the neighborhood — colleges, metro access, and amenities nearby.",
  },
];

// ─── run ────────────────────────────────────────────────────────────────────

async function run() {
  console.log(bold("\n╔══════════════════════════════════════════════════╗"));
  console.log(bold("║      MCPaaS · CribLiv End-to-End Test Suite      ║"));
  console.log(bold("╚══════════════════════════════════════════════════╝\n"));
  console.log(dim(`  MCP Server : ${MCP_SERVER_URL}`));
  console.log(dim(`  Model      : gpt-4o via OpenAI Responses API`));
  console.log(dim(`  Tools      : 6 CribLiv tools\n`));
  console.log("─".repeat(60) + "\n");

  let passed = 0;
  const results: { tool: string; status: "PASS" | "FAIL"; toolsCalled: string[]; ms: number; preview: string }[] = [];

  for (let i = 0; i < TESTS.length; i++) {
    const { tool, prompt } = TESTS[i];
    console.log(bold(`[${i + 1}/6]  Testing: ${tool}`));
    console.log(dim(`       Prompt: "${prompt.slice(0, 80)}..."`));
    process.stdout.write("       Status: running… ");

    const start = Date.now();
    try {
      const { reply, toolsCalled, toolInputs } = await askOpenAI(prompt);
      const ms = Date.now() - start;

      const calledTarget = toolsCalled.includes(tool);
      const status = calledTarget ? "PASS" : "FAIL";
      if (status === "PASS") passed++;

      const icon = status === "PASS" ? green("✓ PASS") : red("✗ FAIL");
      process.stdout.write(`\r       Status: ${icon}  (${ms}ms, tools called: ${toolsCalled.join(", ") || "none"})\n`);

      // Log what GPT sent to each tool
      for (const t of toolInputs) {
        console.log(dim(`       Params : ${JSON.stringify(t.input)}`));
      }

      const preview = reply.slice(0, 200).replace(/\n/g, " ");
      console.log(dim(`       Reply : "${preview}${reply.length > 200 ? "…" : ""}"`));

      results.push({ tool, status, toolsCalled, ms, preview });
    } catch (err: any) {
      const ms = Date.now() - start;
      process.stdout.write(`\r       Status: ${red("✗ ERROR")}  (${ms}ms)\n`);
      console.log(dim(`       Error : ${err.message}`));
      results.push({ tool, status: "FAIL", toolsCalled: [], ms, preview: err.message });
    }

    console.log();
  }

  // ─── Summary ──
  console.log("─".repeat(60));
  console.log(bold("\n  Results\n"));

  for (const r of results) {
    const icon = r.status === "PASS" ? green("✓") : red("✗");
    console.log(`  ${icon}  ${r.tool.padEnd(28)} ${r.status === "PASS" ? green("PASS") : red("FAIL")}  ${r.ms}ms`);
  }

  console.log();
  const pct = Math.round((passed / TESTS.length) * 100);
  const summary = `  ${passed}/${TESTS.length} passed (${pct}%)`;
  console.log(passed === TESTS.length ? green(bold(summary)) : red(bold(summary)));
  console.log("\n" + "─".repeat(60) + "\n");

  process.exit(passed === TESTS.length ? 0 : 1);
}

run().catch((err) => {
  console.error(red(`\n✗ Fatal: ${err.message}`));
  process.exit(1);
});
