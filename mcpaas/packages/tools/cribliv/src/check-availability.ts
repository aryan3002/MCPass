import { z } from "zod";
import { getPropertyById } from "@mcpaas/kernel-datastore";
import type { ToolCallResponse } from "@mcpaas/kernel-types";

export const checkAvailabilitySchema = z.object({
  property_id: z.string().uuid().describe("The unique ID of the property to check availability for"),
});

export const checkAvailabilityDescription =
  "Check whether a specific CribLiv rental property is still available for rent. " +
  "Returns availability status, the earliest move-in date, and verification status.";

export function createCheckAvailabilityHandler(tenantId: string) {
  return async (input: Record<string, unknown>): Promise<ToolCallResponse> => {
    const parsed = checkAvailabilitySchema.parse(input);

    const property = await getPropertyById(tenantId, parsed.property_id);
    if (!property) {
      return {
        success: true,
        data: {
          available: false,
          message: "This property is no longer listed on CribLiv. It may have been rented or removed.",
        },
        metadata: { latencyMs: 0, resultCount: 1 },
      };
    }

    const availableFrom = property.availableFrom
      ? new Date(property.availableFrom)
      : null;
    const isAvailableNow = !availableFrom || availableFrom <= new Date();

    return {
      success: true,
      data: {
        property_id: property.id,
        listing_id: property.listingId,
        title: property.title,
        available: true,
        available_now: isAvailableNow,
        available_from: property.availableFrom ?? "Immediately",
        is_verified: property.isVerified,
        verification_note: property.isVerified
          ? "This listing has been verified by CribLiv's team."
          : "This listing has not yet been verified. Recommend scheduling a visit to confirm details.",
        tip: isAvailableNow
          ? "This property is available now! You can schedule a visit."
          : `This property will be available from ${property.availableFrom}. You can still schedule a future visit.`,
      },
      metadata: { latencyMs: 0, resultCount: 1 },
    };
  };
}
