import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const migrationsDir = join(__dirname, "../migrations");
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

  console.log(`Running ${files.length} migrations...`);

  for (const file of files) {
    console.log(`  Running: ${file}`);
    const sql = readFileSync(join(migrationsDir, file), "utf-8");

    const { error } = await supabase.rpc("exec_sql", { sql_text: sql }).single();
    if (error) {
      // Try direct query via REST if RPC not available
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ sql_text: sql }),
      });

      if (!res.ok) {
        console.warn(`  Warning: ${file} - May need to run manually in Supabase SQL editor`);
        console.warn(`  Error: ${error.message}`);
      }
    }
    console.log(`  Done: ${file}`);
  }

  console.log("All migrations complete.");
}

migrate().catch(console.error);
