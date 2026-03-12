import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verify() {
  console.log("Verifying migrations 006 + 007...\n");

  // Test 006: tool_definitions table
  const { data: toolDefs, error: e1 } = await supabase
    .from("tool_definitions")
    .select("id, name, tenant_id, handler_type, is_enabled")
    .limit(1);

  if (e1) {
    console.log("❌ Migration 006 FAILED — tool_definitions:", e1.message);
  } else {
    console.log("✅ Migration 006 OK — tool_definitions table exists (0 rows, ready)");
  }

  // Test 007: user_id column on tenants
  const { data: tenants, error: e2 } = await supabase
    .from("tenants")
    .select("id, slug, user_id")
    .limit(5);

  if (e2) {
    console.log("❌ Migration 007 FAILED — tenants.user_id:", e2.message);
  } else {
    console.log("✅ Migration 007 OK — tenants.user_id column exists");
    if (tenants && tenants.length > 0) {
      console.log("\n   Existing tenants:");
      tenants.forEach((t) => {
        console.log(`     • ${t.slug} (user_id: ${t.user_id ?? "not set yet"})`);
      });
    }
  }

  console.log("\nAll checks complete.");
}

verify().catch(console.error);
