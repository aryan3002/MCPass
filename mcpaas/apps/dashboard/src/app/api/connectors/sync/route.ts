import { NextResponse } from "next/server";
import { MongoClient, type Document } from "mongodb";
import { getCurrentTenant, getCurrentTenantId, getSupabase } from "@/lib/supabase";

/**
 * POST /api/connectors/sync
 *
 * Reads property documents from CribLiv's MongoDB collection and upserts them
 * into the Supabase `properties` table so the CribLiv MCP tools work with real data.
 *
 * Field mapping:
 *   Update MAP_DOC_TO_ROW below once you share CribLiv's actual MongoDB schema.
 *   Current mapping assumes common field names — adjust as needed.
 */

interface PropertyRow {
  tenant_id: string;
  listing_id: string;
  title: string;
  type: string;
  bedrooms: number | null;
  rent_monthly: number;
  deposit: number | null;
  area_sqft: number | null;
  locality: string;
  city: string;
  address: string | null;
  amenities: string[];
  furnishing: string | null;
  available_from: string | null;
  is_verified: boolean;
  photos: string[];
  description: string | null;
  lease_duration: string | null;
  preferred_tenants: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
}

/**
 * Maps a single MongoDB document → Supabase properties row.
 *
 * TODO: Update field names to match CribLiv's actual MongoDB schema.
 * Common variants are handled (e.g. rent / rent_monthly / rentMonthly).
 */
function mapDocToRow(doc: Document, tenantId: string): PropertyRow | null {
  // ── ID / listing identifier ──────────────────────────────────────────────
  // CribLiv field: could be _id.toString(), listingId, listing_id, propertyId, etc.
  const listingId: string =
    doc.listingId ?? doc.listing_id ?? doc.propertyId ?? doc._id?.toString() ?? "";

  if (!listingId) return null;

  // ── Title ────────────────────────────────────────────────────────────────
  const title: string = doc.title ?? doc.name ?? doc.propertyTitle ?? `Property ${listingId}`;

  // ── Property type ────────────────────────────────────────────────────────
  // Normalise to our enum: 'apartment' | 'pg' | 'villa' | 'studio'
  const rawType = (doc.type ?? doc.propertyType ?? doc.category ?? "apartment")
    .toString()
    .toLowerCase();
  const type = ["apartment", "pg", "villa", "studio"].includes(rawType) ? rawType : "apartment";

  // ── Bedrooms ─────────────────────────────────────────────────────────────
  // CribLiv might store "2BHK" as a string or plain number
  let bedrooms: number | null = null;
  const rawBed = doc.bedrooms ?? doc.bhk ?? doc.bedroom_count ?? doc.noOfBedrooms;
  if (rawBed !== undefined && rawBed !== null) {
    const n = parseInt(String(rawBed), 10);
    if (!isNaN(n)) bedrooms = n;
  }

  // ── Rent ─────────────────────────────────────────────────────────────────
  const rent_monthly: number =
    doc.rent_monthly ?? doc.rentMonthly ?? doc.rent ?? doc.monthlyRent ?? doc.price ?? 0;

  // ── Deposit ──────────────────────────────────────────────────────────────
  const deposit: number | null =
    doc.deposit ?? doc.securityDeposit ?? doc.security_deposit ?? null;

  // ── Area ─────────────────────────────────────────────────────────────────
  const area_sqft: number | null =
    doc.area_sqft ?? doc.areaSqft ?? doc.area ?? doc.carpetArea ?? doc.builtUpArea ?? null;

  // ── Location ─────────────────────────────────────────────────────────────
  const locality: string =
    doc.locality ?? doc.area ?? doc.neighborhood ?? doc.subLocality ?? "";
  const city: string = doc.city ?? doc.location?.city ?? "Bangalore";
  const address: string | null =
    doc.address ?? doc.fullAddress ?? doc.location?.address ?? null;

  // ── Amenities ────────────────────────────────────────────────────────────
  let amenities: string[] = [];
  if (Array.isArray(doc.amenities)) amenities = doc.amenities;
  else if (typeof doc.amenities === "string") amenities = doc.amenities.split(",").map((s: string) => s.trim());

  // ── Furnishing ───────────────────────────────────────────────────────────
  const rawFurn = (doc.furnishing ?? doc.furnishingStatus ?? "").toString();
  const furnishMap: Record<string, string> = {
    furnished: "Furnished",
    "semi-furnished": "Semi-Furnished",
    semifurnished: "Semi-Furnished",
    unfurnished: "Unfurnished",
  };
  const furnishing: string | null = furnishMap[rawFurn.toLowerCase()] ?? null;

  // ── Availability ─────────────────────────────────────────────────────────
  let available_from: string | null = null;
  const rawAvail = doc.available_from ?? doc.availableFrom ?? doc.availabilityDate;
  if (rawAvail) {
    try {
      available_from = new Date(rawAvail).toISOString().split("T")[0]!;
    } catch {
      available_from = null;
    }
  }

  // ── Verified ─────────────────────────────────────────────────────────────
  const is_verified: boolean =
    doc.is_verified ?? doc.isVerified ?? doc.verified ?? false;

  // ── Photos ───────────────────────────────────────────────────────────────
  let photos: string[] = [];
  if (Array.isArray(doc.photos)) photos = doc.photos;
  else if (Array.isArray(doc.images)) photos = doc.images;
  else if (Array.isArray(doc.imageUrls)) photos = doc.imageUrls;
  else if (typeof doc.photo === "string") photos = [doc.photo];

  // ── Description ──────────────────────────────────────────────────────────
  const description: string | null =
    doc.description ?? doc.details ?? doc.about ?? null;

  // ── Lease / tenant prefs ─────────────────────────────────────────────────
  const lease_duration: string | null = doc.lease_duration ?? doc.leaseDuration ?? null;
  const preferred_tenants: string | null =
    doc.preferred_tenants ?? doc.preferredTenants ?? doc.suitableFor ?? null;

  // ── Geo ──────────────────────────────────────────────────────────────────
  const latitude: number | null =
    doc.latitude ?? doc.lat ?? doc.location?.lat ?? doc.location?.latitude ?? null;
  const longitude: number | null =
    doc.longitude ?? doc.lng ?? doc.lon ??
    doc.location?.lng ?? doc.location?.longitude ?? null;

  // ── Active ───────────────────────────────────────────────────────────────
  const is_active: boolean = doc.is_active ?? doc.isActive ?? doc.active ?? true;

  return {
    tenant_id: tenantId,
    listing_id: String(listingId),
    title: String(title),
    type,
    bedrooms,
    rent_monthly: Number(rent_monthly),
    deposit: deposit !== null ? Number(deposit) : null,
    area_sqft: area_sqft !== null ? Number(area_sqft) : null,
    locality: String(locality),
    city: String(city),
    address: address ? String(address) : null,
    amenities,
    furnishing,
    available_from,
    is_verified: Boolean(is_verified),
    photos,
    description: description ? String(description) : null,
    lease_duration: lease_duration ? String(lease_duration) : null,
    preferred_tenants: preferred_tenants ? String(preferred_tenants) : null,
    latitude: latitude !== null ? Number(latitude) : null,
    longitude: longitude !== null ? Number(longitude) : null,
    is_active: Boolean(is_active),
  };
}

// ── Product row for ecommerce domain ────────────────────────────────────────

interface ProductRow {
  tenant_id: string;
  external_id: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  inventory: number | null;
  images: string[];
  categories: string[];
  attributes: Record<string, unknown>;
  is_active: boolean;
}

function mapDocToProduct(doc: Document, tenantId: string): ProductRow | null {
  const externalId = String(doc._id ?? doc.id ?? doc.productId ?? "");
  if (!externalId) return null;
  return {
    tenant_id: tenantId,
    external_id: externalId,
    title: String(doc.title ?? doc.name ?? doc.productName ?? `Product ${externalId}`),
    description: (doc.description ?? doc.details ?? null) as string | null,
    price: Number(doc.price ?? doc.salePrice ?? doc.regularPrice ?? 0),
    currency: String(doc.currency ?? "INR"),
    inventory: (doc.inventory ?? doc.stock ?? doc.quantity ?? null) as number | null,
    images: Array.isArray(doc.images) ? doc.images : (doc.image ? [doc.image] : []),
    categories: Array.isArray(doc.categories) ? doc.categories : (doc.category ? [String(doc.category)] : []),
    attributes: ((doc.attributes ?? doc.variants ?? {}) as Record<string, unknown>),
    is_active: Boolean(doc.is_active ?? doc.isActive ?? doc.active ?? true),
  };
}

export async function POST() {
  const tenant = await getCurrentTenant();
  const tenantId = await getCurrentTenantId();

  if (!tenant || !tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = (tenant.config ?? {}) as Record<string, unknown>;
  const connectorType = config.connectorType as string | undefined;

  if (connectorType !== "mongodb") {
    return NextResponse.json(
      { error: "This endpoint is only for MongoDB connectors" },
      { status: 400 }
    );
  }

  const connectorConfig = (config.connectorConfig ?? {}) as Record<string, string>;
  const mongoUri = connectorConfig.mongoUri;
  const collection = connectorConfig.collection ?? "properties";
  const businessDomain = (config.businessDomain as string) ?? "rental";

  if (!mongoUri) {
    return NextResponse.json(
      { error: "MongoDB URI not configured. Save your credentials first." },
      { status: 400 }
    );
  }

  const supabase = getSupabase();
  let client: MongoClient | null = null;

  try {
    // Connect to MongoDB
    client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 10000 });
    await client.connect();

    // Parse DB name from URI (mongodb+srv://.../<dbname>?...)
    const uriObj = new URL(mongoUri.replace("mongodb+srv://", "https://").replace("mongodb://", "https://"));
    const dbName = uriObj.pathname.replace("/", "") || "test";
    const db = client.db(dbName);

    // Incremental sync: only fetch docs updated since last sync
    const lastSyncAt = connectorConfig.lastSyncAt as string | undefined;
    const mongoFilter = lastSyncAt
      ? { updatedAt: { $gt: new Date(lastSyncAt) } }
      : {};

    const docs = await db.collection(collection).find(mongoFilter).limit(5000).toArray();
    console.log(`[mongo-sync] Fetched ${docs.length} documents from ${dbName}/${collection}${lastSyncAt ? ` (since ${lastSyncAt})` : ""}`);

    if (docs.length === 0) {
      return NextResponse.json({
        success: true,
        message: lastSyncAt
          ? "No new documents since last sync."
          : `Collection "${collection}" is empty. No data synced.`,
        synced: 0,
      });
    }

    const batchSize = 100;
    let synced = 0;
    let errors = 0;

    if (businessDomain === "ecommerce") {
      // ── Ecommerce: map to products table ──
      const rows = docs
        .map((doc) => mapDocToProduct(doc, tenantId))
        .filter((r): r is ProductRow => r !== null);

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase
          .from("products")
          .upsert(batch, { onConflict: "tenant_id,external_id" });

        if (error) {
          console.error(`[mongo-sync] Products batch ${i / batchSize + 1} error:`, error.message);
          errors++;
        } else {
          synced += batch.length;
        }
      }
    } else {
      // ── Rental (default): map to properties table ──
      const rows = docs
        .map((doc) => mapDocToRow(doc, tenantId))
        .filter((r): r is PropertyRow => r !== null);

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase
          .from("properties")
          .upsert(batch, { onConflict: "tenant_id,listing_id" });

        if (error) {
          console.error(`[mongo-sync] Properties batch ${i / batchSize + 1} error:`, error.message);
          errors++;
        } else {
          synced += batch.length;
        }
      }
    }

    // Save lastSyncAt for incremental sync
    const admin = getSupabase();
    await admin.from("tenants").update({
      config: {
        ...config,
        connectorConfig: { ...connectorConfig, lastSyncAt: new Date().toISOString() },
      },
    }).eq("id", tenantId);

    const entityName = businessDomain === "ecommerce" ? "products" : "properties";
    return NextResponse.json({
      success: true,
      message: `Synced ${synced} ${entityName} from MongoDB. ${errors > 0 ? `${errors} batch(es) had errors.` : "All batches succeeded."} Restart your MCP server to pick up the new data.`,
      synced,
      total: docs.length,
      domain: businessDomain,
    });
  } catch (err) {
    console.error("[mongo-sync] Error:", err);
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await client?.close();
  }
}
