import { z } from "zod";
import { searchProperties } from "@mcpaas/kernel-datastore";
import type { ToolCallResponse } from "@mcpaas/kernel-types";

export const searchPropertiesSchema = z.object({
  city: z.string().optional().describe("City to search in, e.g. 'Bangalore'. Leave unset unless user specifies a city."),
  locality: z.string().optional().describe("Neighborhood/area/society name. Only set if user specifies a locality."),
  type: z.enum(["apartment", "pg", "villa", "studio"]).optional().describe("Property type. Only set if user explicitly asks for a specific type."),
  bedrooms: z.number().int().min(1).max(5).optional().describe("Number of bedrooms (1BHK=1, 2BHK=2, 3BHK=3). Only set if user specifies."),
  budget_min: z.number().optional().describe("Minimum monthly rent in INR. Only set if user gives a lower bound."),
  budget_max: z.number().optional().describe("Maximum monthly rent in INR. Only set if user gives an upper bound."),
  amenities: z.array(z.string()).optional().describe("ONLY include amenities the user explicitly requested. Do NOT infer amenities. e.g. ['WiFi', 'Gym', 'Parking']"),
  furnishing: z.enum(["Furnished", "Semi-Furnished", "Unfurnished"]).optional().describe("ONLY set if user explicitly asks for furnished/unfurnished. Do NOT assume furnishing preference."),
  verified_only: z.boolean().optional().describe("ONLY set to true if user explicitly asks for verified listings. Default: leave unset (returns all listings)."),
  limit: z.number().int().min(1).max(20).optional().default(5).describe("Max results to return (default 5)"),
});

export const searchPropertiesDescription =
  "Search CribLiv rental listings across India (currently Bangalore — Koramangala, Indiranagar, HSR Layout, Whitefield, and more). " +
  "Filter by city, locality, budget, bedrooms, amenities, and more. " +
  "Returns a list of matching properties with key details like rent, location, bedrooms, and amenities. " +
  "IMPORTANT: Only apply filters that the user explicitly mentioned. Do NOT assume furnishing, amenities, " +
  "verified_only, or type unless the user specifically asked for them — adding unasked-for filters will " +
  "return zero results. Use this as the first step to help users find apartments, houses, or PG accommodations.";

export function createSearchPropertiesHandler(tenantId: string) {
  return async (input: Record<string, unknown>): Promise<ToolCallResponse> => {
    const parsed = searchPropertiesSchema.parse(input);

    const results = await searchProperties(tenantId, {
      city: parsed.city,
      locality: parsed.locality,
      type: parsed.type,
      bedrooms: parsed.bedrooms,
      budgetMin: parsed.budget_min,
      budgetMax: parsed.budget_max,
      amenities: parsed.amenities,
      furnishing: parsed.furnishing,
      isVerified: parsed.verified_only,
      limit: parsed.limit,
    });

    const listings = results.map((p) => ({
      id: p.id,
      listing_id: p.listingId,
      title: p.title,
      type: p.type,
      bedrooms: p.bedrooms,
      rent_monthly: `₹${p.rentMonthly.toLocaleString("en-IN")}/month`,
      rent_amount: p.rentMonthly,
      deposit: p.deposit ? `₹${p.deposit.toLocaleString("en-IN")}` : "Ask owner",
      area_sqft: p.areaSqft ? `${p.areaSqft} sq.ft.` : null,
      locality: p.locality,
      city: p.city,
      furnishing: p.furnishing,
      amenities: p.amenities,
      is_verified: p.isVerified,
      available_from: p.availableFrom,
      photo: p.photos[0] ?? null,
    }));

    return {
      success: true,
      data: {
        total_results: listings.length,
        listings,
        tip: listings.length === 0
          ? "No listings match your criteria. Try broadening your search (e.g., increase budget or check nearby localities)."
          : `Found ${listings.length} listing(s). Ask for details on any listing by its ID, or compare multiple listings.`,
      },
      metadata: { latencyMs: 0, resultCount: listings.length },
    };
  };
}
