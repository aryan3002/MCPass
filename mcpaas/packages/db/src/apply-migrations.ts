/**
 * Applies migrations 006 and 007 directly to Supabase
 * using the Management API SQL endpoint.
 *
 * Run: npx tsx src/apply-migrations.ts
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// Extract project ref from URL: https://finpdcdqsocwmcnlgunk.supabase.co
const PROJECT_REF = SUPABASE_URL.replace("https://", "").split(".")[0]!;

const MIGRATIONS = ["006_tool_definitions.sql", "007_tenant_user.sql"];

async function applySql(sql: string, label: string): Promise<boolean> {
  // Try Supabase Management API (requires service role header)
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (res.ok) return true;

  // Try the Supabase SQL API via direct REST (works with service_role key in some versions)
  const res2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql_text: sql }),
  });

  if (res2.ok) return true;

  const err1 = await res.text().catch(() => "unknown");
  const err2 = await res2.text().catch(() => "unknown");
  console.error(`  [Management API] ${res.status}: ${err1}`);
  console.error(`  [exec_sql RPC]   ${res2.status}: ${err2}`);
  return false;
}

async function main() {
  console.log(`Project: ${PROJECT_REF}`);
  console.log(`Applying ${MIGRATIONS.length} migrations...\n`);

  for (const file of MIGRATIONS) {
    const filePath = join(__dirname, "../migrations", file);
    const sql = readFileSync(filePath, "utf-8");

    process.stdout.write(`  Applying ${file}... `);
    const ok = await applySql(sql, file);

    if (ok) {
      console.log("✓");
    } else {
      console.log("✗ (see error above)");
      console.log(`\n  === SQL for manual apply in Supabase SQL editor ===`);
      console.log(`  File: packages/db/migrations/${file}`);
      console.log(`\n${sql}`);
      console.log("  ===================================================\n");
    }
  }

  console.log("\nDone.");
}

main().catch(console.error);
