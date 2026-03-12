import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// Bangalore Rental Market Data - Realistic mock data
// ============================================================

const LOCALITIES = [
  { name: "Koramangala", lat: 12.9352, lng: 77.6245 },
  { name: "Indiranagar", lat: 12.9784, lng: 77.6408 },
  { name: "HSR Layout", lat: 12.9116, lng: 77.6389 },
  { name: "Whitefield", lat: 12.9698, lng: 77.7500 },
  { name: "Electronic City", lat: 12.8399, lng: 77.6770 },
  { name: "Marathahalli", lat: 12.9591, lng: 77.7009 },
  { name: "BTM Layout", lat: 12.9166, lng: 77.6101 },
  { name: "JP Nagar", lat: 12.9063, lng: 77.5857 },
  { name: "Jayanagar", lat: 12.9250, lng: 77.5938 },
  { name: "Hebbal", lat: 13.0358, lng: 77.5970 },
  { name: "Yelahanka", lat: 13.1007, lng: 77.5963 },
  { name: "Bannerghatta Road", lat: 12.8876, lng: 77.5973 },
  { name: "Sarjapur Road", lat: 12.9100, lng: 77.6800 },
  { name: "MG Road", lat: 12.9758, lng: 77.6063 },
  { name: "Bellandur", lat: 12.9260, lng: 77.6762 },
  { name: "Rajajinagar", lat: 12.9867, lng: 77.5576 },
  { name: "Malleshwaram", lat: 13.0035, lng: 77.5710 },
  { name: "Basavanagudi", lat: 12.9400, lng: 77.5750 },
  { name: "Frazer Town", lat: 12.9988, lng: 77.6128 },
  { name: "RT Nagar", lat: 13.0210, lng: 77.5960 },
];

const AMENITIES_POOL = [
  "WiFi", "Gym", "Swimming Pool", "Parking", "Power Backup",
  "Security", "CCTV", "Lift", "Garden", "Clubhouse",
  "Children's Play Area", "Washing Machine", "AC", "Geyser",
  "Water Purifier", "Gas Pipeline", "Intercom", "Balcony",
  "Modular Kitchen", "Wardrobe",
];

const PROPERTY_TITLES_1BHK = [
  "Cozy 1BHK in Prime Location",
  "Modern 1BHK Apartment with Balcony",
  "Compact 1BHK near Metro Station",
  "Bright 1BHK with City View",
  "Well-Maintained 1BHK Flat",
  "Affordable 1BHK in Gated Community",
];

const PROPERTY_TITLES_2BHK = [
  "Spacious 2BHK in Gated Community",
  "Modern 2BHK with Premium Amenities",
  "Airy 2BHK Apartment near Park",
  "Fully Furnished 2BHK Flat",
  "2BHK with Modular Kitchen & Balcony",
  "Well-Connected 2BHK near IT Hub",
  "Premium 2BHK with Swimming Pool Access",
  "Family-Friendly 2BHK in Quiet Area",
];

const PROPERTY_TITLES_3BHK = [
  "Luxurious 3BHK with Panoramic View",
  "Spacious 3BHK for Family Living",
  "Premium 3BHK in Top Society",
  "3BHK with Servant Room & Parking",
  "Modern 3BHK near International School",
  "3BHK Corner Unit with Cross Ventilation",
];

const DESCRIPTIONS = [
  "Well-maintained apartment in a peaceful residential area. Close to schools, hospitals, and shopping centres. 24/7 security and water supply.",
  "Modern apartment with excellent connectivity to major IT parks. Surrounded by restaurants and entertainment options. Ideal for working professionals.",
  "Bright and airy apartment in a well-established society. Regular maintenance and professional management. Great community living experience.",
  "Recently renovated flat with premium fittings. Vitrified tile flooring throughout. Spacious rooms with ample natural light and ventilation.",
  "Located in one of Bangalore's most sought-after neighborhoods. Walking distance to metro station. Multiple bus routes nearby.",
  "Perfect for families with children. Near reputed schools and parks. Safe and secure gated community with round-the-clock surveillance.",
  "Ideal bachelor/couple accommodation. Vibrant neighborhood with cafes, pubs, and co-working spaces. Pet-friendly society.",
  "Luxury living at affordable rent. World-class amenities including rooftop garden, yoga room, and indoor games. Smart home features.",
];

const TENANT_PREFS = [
  "Family",
  "Working Professionals",
  "Bachelor",
  "Family or Working Professionals",
  "Any",
  "Working Professionals or Bachelor",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function pickRandomN<T>(arr: T[], min: number, max: number): T[] {
  const n = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function generateListingId(index: number): string {
  return `CRIB-${(1000 + index).toString()}`;
}

interface PropertyRow {
  tenant_id: string;
  listing_id: string;
  title: string;
  type: string;
  bedrooms: number;
  rent_monthly: number;
  deposit: number;
  area_sqft: number;
  locality: string;
  city: string;
  address: string;
  amenities: string[];
  furnishing: string;
  available_from: string;
  is_verified: boolean;
  photos: string[];
  description: string;
  lease_duration: string;
  preferred_tenants: string;
  latitude: number;
  longitude: number;
  owner_contact: string;
  is_active: boolean;
}

function generateProperty(tenantId: string, index: number): PropertyRow {
  const locality = pickRandom(LOCALITIES);
  const bedrooms = pickRandom([1, 1, 2, 2, 2, 2, 3, 3]);
  const furnishing = pickRandom(["Furnished", "Semi-Furnished", "Unfurnished"]) as string;

  // Realistic Bangalore rent ranges by BHK and locality tier
  const premiumLocalities = ["Koramangala", "Indiranagar", "MG Road", "Jayanagar", "Malleshwaram"];
  const isPremium = premiumLocalities.includes(locality.name);
  const multiplier = isPremium ? 1.4 : 1.0;
  const furnishedMultiplier = furnishing === "Furnished" ? 1.3 : furnishing === "Semi-Furnished" ? 1.15 : 1.0;

  const baseRent =
    bedrooms === 1 ? randomInt(10000, 18000) :
    bedrooms === 2 ? randomInt(15000, 30000) :
    randomInt(25000, 50000);
  const rent = Math.round((baseRent * multiplier * furnishedMultiplier) / 500) * 500;
  const deposit = rent * randomInt(2, 6);

  const baseSqft =
    bedrooms === 1 ? randomInt(450, 700) :
    bedrooms === 2 ? randomInt(800, 1200) :
    randomInt(1200, 2000);

  const titles =
    bedrooms === 1 ? PROPERTY_TITLES_1BHK :
    bedrooms === 2 ? PROPERTY_TITLES_2BHK :
    PROPERTY_TITLES_3BHK;

  const amenities = pickRandomN(AMENITIES_POOL, 4, 10);
  if (furnishing === "Furnished" && !amenities.includes("AC")) amenities.push("AC");
  if (furnishing === "Furnished" && !amenities.includes("Washing Machine")) amenities.push("Washing Machine");

  // Available from: random date in next 2 months
  const availDate = new Date();
  availDate.setDate(availDate.getDate() + randomInt(0, 60));

  // Slight random offset from locality center for realistic geo data
  const latOffset = (Math.random() - 0.5) * 0.02;
  const lngOffset = (Math.random() - 0.5) * 0.02;

  return {
    tenant_id: tenantId,
    listing_id: generateListingId(index),
    title: `${pickRandom(titles)} - ${locality.name}`,
    type: "apartment",
    bedrooms,
    rent_monthly: rent,
    deposit,
    area_sqft: baseSqft,
    locality: locality.name,
    city: "Bangalore",
    address: `${randomInt(1, 99)}, ${randomInt(1, 12)}th Cross, ${locality.name}, Bangalore`,
    amenities,
    furnishing,
    available_from: availDate.toISOString().split("T")[0]!,
    is_verified: Math.random() > 0.2, // 80% verified
    photos: [
      `https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800`,
      `https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800`,
      `https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800`,
    ],
    description: pickRandom(DESCRIPTIONS),
    lease_duration: pickRandom(["6 months", "11 months", "12 months", "24 months"]),
    preferred_tenants: pickRandom(TENANT_PREFS),
    latitude: locality.lat + latOffset,
    longitude: locality.lng + lngOffset,
    owner_contact: `Owner ${index}: +91-${randomInt(7000000000, 9999999999)}`,
    is_active: true,
  };
}

async function seed() {
  console.log("Seeding MCPaaS database...\n");

  // 1. Create CribLiv tenant
  const apiKey = process.env.MCP_API_KEY ?? "mcpaas-cribliv-dev-key-2026";
  const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .upsert(
      {
        name: "CribLiv",
        slug: "cribliv",
        api_key_hash: apiKeyHash,
        plan: "growth",
        config: {
          maxToolCallsPerDay: 10000,
          enabledSurfaces: ["mcp", "rest"],
        },
      },
      { onConflict: "slug" }
    )
    .select()
    .single();

  if (tenantError) {
    console.error("Failed to create tenant:", tenantError);
    process.exit(1);
  }

  console.log(`Created tenant: ${tenant.name} (${tenant.id})`);
  console.log(`  API Key: ${apiKey}`);
  console.log(`  Slug: ${tenant.slug}\n`);

  // 2. Generate 180 properties
  const NUM_PROPERTIES = 180;
  const properties: PropertyRow[] = [];
  for (let i = 0; i < NUM_PROPERTIES; i++) {
    properties.push(generateProperty(tenant.id, i));
  }

  // Insert in batches of 50
  const batchSize = 50;
  let inserted = 0;
  for (let i = 0; i < properties.length; i += batchSize) {
    const batch = properties.slice(i, i + batchSize);
    const { error } = await supabase.from("properties").upsert(batch, {
      onConflict: "tenant_id,listing_id",
    });
    if (error) {
      console.error(`Failed to insert batch ${i / batchSize + 1}:`, error);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`Inserted ${inserted} properties\n`);

  // 3. Print summary stats
  const localities = [...new Set(properties.map((p) => p.locality))];
  const avgRent = Math.round(properties.reduce((sum, p) => sum + p.rent_monthly, 0) / properties.length);

  console.log("Data Summary:");
  console.log(`  Total listings: ${inserted}`);
  console.log(`  Localities: ${localities.length} (${localities.slice(0, 5).join(", ")}...)`);
  console.log(`  Average rent: ₹${avgRent.toLocaleString()}/month`);
  console.log(`  1BHK: ${properties.filter((p) => p.bedrooms === 1).length}`);
  console.log(`  2BHK: ${properties.filter((p) => p.bedrooms === 2).length}`);
  console.log(`  3BHK: ${properties.filter((p) => p.bedrooms === 3).length}`);
  console.log(`\nDone! MCP API Key: ${apiKey}`);
}

seed().catch(console.error);
