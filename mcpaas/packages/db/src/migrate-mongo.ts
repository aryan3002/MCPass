/**
 * MCPaaS: MongoDB → Supabase Migration
 * Reads real CribLiv data from MongoDB and loads it into Supabase
 *
 * Run: pnpm --filter @mcpaas/db db:migrate-mongo
 */

import { MongoClient, ObjectId } from "mongodb";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import "dotenv/config";

// ─── Config ────────────────────────────────────────────────────────────────

const MONGODB_URL = process.env.MONGODB_URL!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!MONGODB_URL || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing MONGODB_URL, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const DRY_RUN = process.argv.includes("--dry-run");

// ─── Type normalizers ──────────────────────────────────────────────────────

function normalizeType(raw: string | undefined): "apartment" | "pg" | "villa" | "studio" {
  if (!raw) return "apartment";
  const t = raw.toLowerCase().trim();
  if (t === "pg") return "pg";
  if (t.includes("studio")) return "studio";
  if (t.includes("villa") || t.includes("independent") || t.includes("bungalow") || t.includes("house")) return "villa";
  return "apartment"; // flat, apartment, 2bhk, etc.
}

function normalizeFurnishing(raw: string | undefined): "Furnished" | "Semi-Furnished" | "Unfurnished" | null {
  if (!raw) return null;
  const f = raw.toLowerCase().trim();
  if (f.includes("fully") || f === "furnished") return "Furnished";
  if (f.includes("semi")) return "Semi-Furnished";
  if (f.includes("un") || f === "unfurnished") return "Unfurnished";
  return null;
}

function normalizeAmenities(raw: unknown[]): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a: any) => {
      if (typeof a === "string") return a.trim();
      // CribLiv stores { amenityName: "WiFi" } or { serviceName: "Food" }
      if (typeof a === "object" && a?.amenityName) return String(a.amenityName).trim();
      if (typeof a === "object" && a?.serviceName) return String(a.serviceName).trim();
      if (typeof a === "object" && a?.name) return String(a.name).trim();
      return null;
    })
    .filter(Boolean) as string[];
}

// Extract lat/lng from multiple possible MongoDB location formats
function extractCoords(loc: any): { lat: number | null; lng: number | null } {
  if (!loc || typeof loc !== "object") return { lat: null, lng: null };

  // GeoJSON Point: { type: "Point", coordinates: [lng, lat] }
  // cityLocation stores coordinates as strings — use parseFloat
  if (loc.type === "Point" && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
    const lng = parseFloat(String(loc.coordinates[0]));
    const lat = parseFloat(String(loc.coordinates[1]));
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  // Flat: { lat, lng } or { latitude, longitude }
  const lat = parseFloat(String(loc.lat ?? loc.latitude ?? ""));
  const lng = parseFloat(String(loc.lng ?? loc.longitude ?? ""));
  if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };

  return { lat: null, lng: null };
}

function extractPhotos(images: any): string[] {
  if (!Array.isArray(images) || images.length === 0) return [];
  // CribLiv stores filenames like "1731754128915.JPG"
  // Prefix with CribLiv CDN base — update this when you know the real CDN URL
  const PHOTO_BASE = "https://api.cribliv.com/uploads/";
  return images
    .map((img: any) => {
      if (typeof img === "string" && img.startsWith("http")) return img;
      if (typeof img === "string" && img.length > 4) return `${PHOTO_BASE}${img}`;
      if (typeof img === "object" && img?.url) return String(img.url);
      if (typeof img === "object" && img?.secure_url) return String(img.secure_url);
      return null;
    })
    .filter(Boolean) as string[];
}

function buildAddress(doc: any): string {
  return [doc.houseNum, doc.society, doc.landmark, doc.city, doc.state]
    .map((s: any) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .join(", ");
}

// Filter out obvious test/junk data
function isValidListing(doc: any, source: "properties" | "pgs"): boolean {
  const rent = Number(doc.expected_rent);
  if (!rent || rent < 1000 || rent > 10_000_000) return false; // rent sanity check
  if (!doc.city || typeof doc.city !== "string" || doc.city.trim().length < 2) return false;
  // Skip records with obvious test descriptions
  const desc = (doc.description ?? "").toLowerCase();
  if (desc.length > 0 && desc.length < 20) return false; // too short = test
  return true;
}

// ─── Map MongoDB property doc → Supabase row ──────────────────────────────

function mapProperty(doc: any, tenantId: string): Record<string, unknown> {
  const { lat, lng } = extractCoords(doc.location ?? doc.cityLocation);
  const locality = (doc.society || doc.landmark || doc.city || "").trim();

  return {
    id: randomUUID(),
    tenant_id: tenantId,
    listing_id: `CRIB-P-${(doc._id as ObjectId).toHexString().slice(-8).toUpperCase()}`,
    title: buildTitle(doc, "property"),
    type: normalizeType(doc.type),
    bedrooms: typeof doc.bedrooms === "number" ? doc.bedrooms : null,
    rent_monthly: Number(doc.expected_rent),
    deposit: doc.expected_deposit ? Number(doc.expected_deposit) : null,
    area_sqft: doc.area ? Number(doc.area) : null,
    locality,
    city: doc.city?.trim() ?? "Unknown",
    address: buildAddress(doc),
    amenities: normalizeAmenities(doc.amenities ?? []),
    furnishing: normalizeFurnishing(doc.furnishing),
    available_from: doc.avail_from ? new Date(doc.avail_from).toISOString().split("T")[0] : null,
    is_verified: Boolean(doc.verified),
    photos: extractPhotos(doc.images ?? []),
    description: doc.description ?? null,
    lease_duration: "11 months",
    preferred_tenants: doc.pref_tenant ?? null,
    latitude: lat,
    longitude: lng,
    owner_contact: doc.ownerPhone ?? doc.owner ?? null,
    is_active: true,
  };
}

function mapPg(doc: any, tenantId: string): Record<string, unknown> {
  const { lat, lng } = extractCoords(doc.location ?? doc.cityLocation);
  const locality = (doc.society || doc.landmark || doc.city || "").trim();

  // PGs have rooms array — extract bed count and area
  const rooms = Array.isArray(doc.rooms) ? doc.rooms : [];
  const totalBeds = rooms.reduce((sum: number, r: any) => sum + (r.singleBeds ?? 0) + (r.doubleBeds ?? 0), 0);
  const totalArea = rooms.reduce((sum: number, r: any) => sum + (r.area ?? 0), 0);

  // Combine amenities + services
  const allAmenities = [
    ...normalizeAmenities(doc.amenities ?? []),
    ...normalizeAmenities(doc.services ?? []),
  ];
  const uniqueAmenities = [...new Set(allAmenities)];

  return {
    id: randomUUID(),
    tenant_id: tenantId,
    listing_id: `CRIB-G-${(doc._id as ObjectId).toHexString().slice(-8).toUpperCase()}`,
    title: buildTitle(doc, "pg"),
    type: "pg" as const,
    bedrooms: totalBeds > 0 ? totalBeds : (rooms.length > 0 ? rooms.length : null),
    rent_monthly: Number(doc.expected_rent),
    deposit: doc.expected_deposit ? Number(doc.expected_deposit) : null,
    area_sqft: totalArea > 0 ? totalArea : null,
    locality,
    city: doc.city?.trim() ?? "Unknown",
    address: buildAddress(doc),
    amenities: uniqueAmenities,
    furnishing: normalizeFurnishing(doc.furnishing),
    available_from: doc.avail_from ? new Date(doc.avail_from).toISOString().split("T")[0] : null,
    is_verified: Boolean(doc.verified),
    photos: extractPhotos(doc.images ?? []),
    description: doc.description ?? null,
    lease_duration: null,
    preferred_tenants: doc.pref_tenant ?? null,
    latitude: lat,
    longitude: lng,
    owner_contact: doc.ownerPhone ?? null,
    is_active: true,
  };
}

function buildTitle(doc: any, kind: "property" | "pg"): string {
  const bedrooms = doc.bedrooms;
  const bhk = bedrooms ? `${bedrooms}BHK ` : "";
  const type = kind === "pg" ? "PG Accommodation" : (doc.type ?? "Apartment");
  const locality = doc.society || doc.landmark || doc.city || "";
  const city = doc.city ? ` - ${doc.city}` : "";
  return `${bhk}${type} in ${locality}${city}`.replace(/\s+/g, " ").trim();
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function run() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log(`║   MCPaaS · MongoDB → Supabase Migration${DRY_RUN ? " (DRY)" : ""}      ║`);
  console.log("╚══════════════════════════════════════════════════╝\n");

  // ── Connect MongoDB ──────────────────────────────────────────────────────
  console.log("→ Connecting to MongoDB...");
  const mongo = new MongoClient(MONGODB_URL);
  await mongo.connect();
  console.log("  Connected ✓");

  // Auto-detect database name
  const dbName = new URL(MONGODB_URL.replace("mongodb+srv://", "https://")).pathname.slice(1) || "test";
  const db = mongo.db(dbName);

  // ── Discover collections ─────────────────────────────────────────────────
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);
  console.log(`  Database: ${dbName}`);
  console.log(`  Collections: ${collectionNames.join(", ")}\n`);

  // ── Fetch data ───────────────────────────────────────────────────────────
  const rawProperties = collectionNames.includes("properties")
    ? await db.collection("properties").find({}).toArray()
    : [];
  const rawPgs = collectionNames.includes("pgs")
    ? await db.collection("pgs").find({}).toArray()
    : [];

  console.log(`→ Found ${rawProperties.length} properties, ${rawPgs.length} PGs in MongoDB`);

  // ── Print schema sample ──────────────────────────────────────────────────
  if (rawProperties[0]) {
    console.log("\n  Sample property fields:", Object.keys(rawProperties[0]).join(", "));
  }
  if (rawPgs[0]) {
    console.log("  Sample PG fields:", Object.keys(rawPgs[0]).join(", "));
  }

  // ── Get CribLiv tenant ───────────────────────────────────────────────────
  console.log("\n→ Fetching CribLiv tenant from Supabase...");
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .select("id, name, slug")
    .eq("slug", "cribliv")
    .single();

  if (tenantErr || !tenant) {
    console.error("  Tenant 'cribliv' not found. Run pnpm db:seed first.");
    process.exit(1);
  }
  console.log(`  Tenant: ${tenant.name} (${tenant.id}) ✓`);

  // ── Validate + map data ──────────────────────────────────────────────────
  const validProperties = rawProperties.filter((d) => isValidListing(d, "properties"));
  const validPgs = rawPgs.filter((d) => isValidListing(d, "pgs"));

  console.log(`\n→ After validation: ${validProperties.length} properties, ${validPgs.length} PGs`);
  const skipped = (rawProperties.length - validProperties.length) + (rawPgs.length - validPgs.length);
  if (skipped > 0) console.log(`  Skipped ${skipped} records (test/invalid data)`);

  const rows = [
    ...validProperties.map((d) => mapProperty(d, tenant.id)),
    ...validPgs.map((d) => mapPg(d, tenant.id)),
  ];

  console.log(`  Total rows to insert: ${rows.length}`);

  // ── Preview ──────────────────────────────────────────────────────────────
  if (rows.length > 0) {
    console.log("\n  Preview (first 3):");
    for (const row of rows.slice(0, 3)) {
      console.log(`    [${row.listing_id}] ${row.title}`);
      console.log(`      Rent: ₹${Number(row.rent_monthly).toLocaleString("en-IN")} | ${row.city} | ${row.type} | ${row.bedrooms ?? "?"} BHK`);
      console.log(`      Photos: ${(row.photos as string[]).length} | Amenities: ${(row.amenities as string[]).length}`);
    }
  }

  if (DRY_RUN) {
    console.log("\n  DRY RUN — no changes written.");
    await mongo.close();
    return;
  }

  // ── Clear existing mock data ─────────────────────────────────────────────
  console.log("\n→ Clearing existing properties for cribliv...");
  const { error: deleteErr } = await supabase
    .from("properties")
    .delete()
    .eq("tenant_id", tenant.id);

  if (deleteErr) {
    console.error("  Error clearing properties:", deleteErr.message);
    process.exit(1);
  }
  console.log("  Cleared ✓");

  // ── Insert in batches ────────────────────────────────────────────────────
  console.log(`\n→ Inserting ${rows.length} listings...`);
  const BATCH = 50;
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from("properties").insert(batch);
    if (error) {
      console.error(`  Batch ${i}-${i + BATCH} error: ${error.message}`);
      failed += batch.length;
    } else {
      inserted += batch.length;
      process.stdout.write(`  Progress: ${inserted}/${rows.length}\r`);
    }
  }

  console.log(`\n  Inserted: ${inserted} ✓`);
  if (failed > 0) console.log(`  Failed:   ${failed}`);

  // ── Verify ───────────────────────────────────────────────────────────────
  const { count } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .then((r) => ({ count: r.count ?? 0 }));

  // ── City breakdown ───────────────────────────────────────────────────────
  const cities: Record<string, number> = {};
  for (const r of rows) {
    const city = r.city as string;
    cities[city] = (cities[city] ?? 0) + 1;
  }

  console.log("\n  Supabase verification:");
  console.log(`    Total in DB: ${count}`);
  console.log(`\n  Cities:`);
  for (const [city, cnt] of Object.entries(cities).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`    ${city.padEnd(20)} ${cnt}`);
  }

  await mongo.close();
  console.log("\n✓ Migration complete!\n");
}

run().catch((err) => {
  console.error("\n✗ Migration failed:", err.message);
  console.error(err.stack);
  process.exit(1);
});
