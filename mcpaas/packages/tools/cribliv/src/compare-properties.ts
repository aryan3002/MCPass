import { z } from "zod";
import { getPropertiesByIds } from "@mcpaas/kernel-datastore";
import type { ToolCallResponse } from "@mcpaas/kernel-types";

export const comparePropertiesSchema = z.object({
  property_ids: z
    .array(z.string().uuid())
    .min(2)
    .max(4)
    .describe("List of 2–4 property IDs to compare side by side"),
});

export const comparePropertiesDescription =
  "Compare 2 to 4 CribLiv rental properties side by side on key attributes: " +
  "rent, deposit, size, bedrooms, locality, amenities, furnishing, and verification status. " +
  "Use this when a user wants to evaluate multiple listings before making a decision.";

export function createComparePropertiesHandler(tenantId: string) {
  return async (input: Record<string, unknown>): Promise<ToolCallResponse> => {
    const parsed = comparePropertiesSchema.parse(input);

    const properties = await getPropertiesByIds(tenantId, parsed.property_ids);
    if (properties.length < 2) {
      return {
        success: false,
        error: {
          code: "INSUFFICIENT_RESULTS",
          message: `Only found ${properties.length} of ${parsed.property_ids.length} properties. Some may no longer be available.`,
        },
        metadata: { latencyMs: 0 },
      };
    }

    const comparison = properties.map((p) => ({
      id: p.id,
      listing_id: p.listingId,
      title: p.title,
      rent_monthly: `₹${p.rentMonthly.toLocaleString("en-IN")}/month`,
      rent_amount: p.rentMonthly,
      deposit: p.deposit ? `₹${p.deposit.toLocaleString("en-IN")}` : "Ask owner",
      bedrooms: p.bedrooms,
      area_sqft: p.areaSqft ?? "N/A",
      locality: p.locality,
      furnishing: p.furnishing,
      amenities: p.amenities,
      is_verified: p.isVerified,
      available_from: p.availableFrom ?? "Immediately",
    }));

    // Find shared and unique amenities
    const allAmenities = properties.map((p) => new Set(p.amenities));
    const sharedAmenities = [...allAmenities[0]!].filter((a) =>
      allAmenities.every((set) => set.has(a))
    );

    // Price comparison
    const rents = properties.map((p) => p.rentMonthly);
    const cheapest = properties[rents.indexOf(Math.min(...rents))]!;
    const mostExpensive = properties[rents.indexOf(Math.max(...rents))]!;

    return {
      success: true,
      data: {
        properties: comparison,
        summary: {
          cheapest: { id: cheapest.id, title: cheapest.title, rent: cheapest.rentMonthly },
          most_expensive: { id: mostExpensive.id, title: mostExpensive.title, rent: mostExpensive.rentMonthly },
          price_difference: `₹${(mostExpensive.rentMonthly - cheapest.rentMonthly).toLocaleString("en-IN")}/month`,
          shared_amenities: sharedAmenities,
          total_compared: comparison.length,
        },
        tip: "You can get more details on any property, check neighborhood info, or schedule a visit.",
      },
      metadata: { latencyMs: 0, resultCount: comparison.length },
    };
  };
}
