import { z } from "zod";
import { getPropertyById, createVisitRequest } from "@mcpaas/kernel-datastore";
import type { ToolCallResponse } from "@mcpaas/kernel-types";

export const scheduleVisitSchema = z.object({
  property_id: z.string().uuid().describe("The ID of the property to visit"),
  visitor_name: z.string().min(2).describe("Full name of the person visiting"),
  visitor_phone: z.string().min(10).describe("Phone number for visit confirmation (Indian format: +91-XXXXXXXXXX or 10 digits)"),
  visitor_email: z.string().email().optional().describe("Email address (optional)"),
  preferred_date: z.string().describe("Preferred visit date in YYYY-MM-DD format"),
  preferred_time: z.enum(["morning", "afternoon", "evening"]).describe("Preferred time slot: 'morning' (9am-12pm), 'afternoon' (12pm-4pm), or 'evening' (4pm-7pm)"),
  notes: z.string().optional().describe("Any special requests or questions for the visit"),
});

export const scheduleVisitDescription =
  "Schedule a property visit at a CribLiv rental listing. " +
  "Requires the visitor's name, phone number, preferred date and time slot. " +
  "CribLiv's team will confirm the visit and contact the visitor. " +
  "This is a transactional action — confirm the details with the user before calling this tool.";

export function createScheduleVisitHandler(tenantId: string) {
  return async (input: Record<string, unknown>): Promise<ToolCallResponse> => {
    const parsed = scheduleVisitSchema.parse(input);

    // Verify property exists
    const property = await getPropertyById(tenantId, parsed.property_id);
    if (!property) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Property not found or no longer available" },
        metadata: { latencyMs: 0 },
      };
    }

    // Validate date is in the future
    const visitDate = new Date(parsed.preferred_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (visitDate < today) {
      return {
        success: false,
        error: { code: "INVALID_DATE", message: "Visit date must be today or in the future" },
        metadata: { latencyMs: 0 },
      };
    }

    // Create visit request
    const visit = await createVisitRequest({
      tenantId,
      propertyId: parsed.property_id,
      visitorName: parsed.visitor_name,
      visitorPhone: parsed.visitor_phone,
      visitorEmail: parsed.visitor_email,
      preferredDate: parsed.preferred_date,
      preferredTime: parsed.preferred_time,
      notes: parsed.notes,
    });

    const timeSlots = {
      morning: "9:00 AM – 12:00 PM",
      afternoon: "12:00 PM – 4:00 PM",
      evening: "4:00 PM – 7:00 PM",
    };

    return {
      success: true,
      data: {
        visit_id: visit.id,
        status: "confirmed",
        property: {
          id: property.id,
          title: property.title,
          locality: property.locality,
          address: property.address,
        },
        visit_details: {
          date: parsed.preferred_date,
          time_slot: timeSlots[parsed.preferred_time],
          visitor_name: parsed.visitor_name,
          visitor_phone: parsed.visitor_phone,
        },
        message: `Visit scheduled! CribLiv's team will contact ${parsed.visitor_name} at ${parsed.visitor_phone} to confirm the visit on ${parsed.preferred_date} (${timeSlots[parsed.preferred_time]}).`,
        note: "CribLiv offers zero brokerage — there are no extra charges for this visit.",
      },
      metadata: { latencyMs: 0, resultCount: 1 },
    };
  };
}
