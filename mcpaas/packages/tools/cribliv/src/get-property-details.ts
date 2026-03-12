import { z } from "zod";
import { getPropertyById } from "@mcpaas/kernel-datastore";
import type { ToolCallResponse } from "@mcpaas/kernel-types";

export const getPropertyDetailsSchema = z.object({
  property_id: z.string().uuid().describe("The unique ID of the property to get details for"),
});

export const getPropertyDetailsDescription =
  "Get complete details about a specific CribLiv rental property. " +
  "Returns full information including all photos, detailed description, complete amenity list, " +
  "deposit amount, lease terms, preferred tenant type, and more. " +
  "Use this after search_properties to show a user full details about a listing they're interested in.";

export function createGetPropertyDetailsHandler(tenantId: string) {
  return async (input: Record<string, unknown>): Promise<ToolCallResponse> => {
    const parsed = getPropertyDetailsSchema.parse(input);

    const property = await getPropertyById(tenantId, parsed.property_id);
    if (!property) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Property not found or no longer available" },
        metadata: { latencyMs: 0 },
      };
    }

    return {
      success: true,
      data: {
        id: property.id,
        listing_id: property.listingId,
        title: property.title,
        type: property.type,
        bedrooms: property.bedrooms,
        rent_monthly: `₹${property.rentMonthly.toLocaleString("en-IN")}/month`,
        rent_amount: property.rentMonthly,
        deposit: property.deposit ? `₹${property.deposit.toLocaleString("en-IN")}` : "Ask owner",
        deposit_amount: property.deposit,
        area_sqft: property.areaSqft ? `${property.areaSqft} sq.ft.` : "Not specified",
        locality: property.locality,
        city: property.city,
        address: property.address,
        furnishing: property.furnishing,
        amenities: property.amenities,
        description: property.description,
        photos: property.photos,
        is_verified: property.isVerified,
        available_from: property.availableFrom,
        lease_duration: property.leaseDuration,
        preferred_tenants: property.preferredTenants,
        tip: "You can compare this with other properties, check neighborhood info, or schedule a visit.",
      },
      metadata: { latencyMs: 0, resultCount: 1 },
    };
  };
}
