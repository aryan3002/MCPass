import type { ConnectorCapabilities } from "@mcpaas/kernel-connectors";
import type { ToolTemplate } from "./templates.js";

/**
 * Rental/Real Estate tool templates — the rental equivalent of COMMERCE_TOOL_TEMPLATES.
 * Mirrors the CribLiv tool schemas as JSON Schema ToolTemplate objects.
 */
export const RENTAL_TOOL_TEMPLATES: Record<string, ToolTemplate> = {
  search_properties: {
    name: "search_properties",
    description:
      "Search rental listings. Filter by city, locality, budget, bedrooms, amenities, and more. " +
      "Returns a list of matching properties with key details like rent, location, bedrooms, and amenities. " +
      "IMPORTANT: Only apply filters that the user explicitly mentioned. Do NOT assume furnishing, amenities, " +
      "verified_only, or type unless the user specifically asked for them.",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City to search in, e.g. 'Bangalore'" },
        locality: { type: "string", description: "Neighborhood/area/society name" },
        type: {
          type: "string",
          enum: ["apartment", "pg", "villa", "studio"],
          description: "Property type",
        },
        bedrooms: { type: "integer", description: "Number of bedrooms (1BHK=1, 2BHK=2, 3BHK=3)" },
        budget_min: { type: "number", description: "Minimum monthly rent in INR" },
        budget_max: { type: "number", description: "Maximum monthly rent in INR" },
        amenities: {
          type: "array",
          items: { type: "string" },
          description: "Only include amenities the user explicitly requested",
        },
        furnishing: {
          type: "string",
          enum: ["Furnished", "Semi-Furnished", "Unfurnished"],
          description: "Only set if user explicitly asks for furnished/unfurnished",
        },
        verified_only: { type: "boolean", description: "Only set true if user asks for verified listings" },
        limit: { type: "integer", description: "Max results (default 5, max 20)" },
      },
    },
    handlerType: "connector",
    handlerConfig: { method: "searchListings" },
  },

  get_property_details: {
    name: "get_property_details",
    description:
      "Get complete details about a specific rental property. " +
      "Returns full information including all photos, detailed description, complete amenity list, " +
      "deposit amount, lease terms, preferred tenant type, and more. " +
      "Use this after search_properties to show a user full details about a listing.",
    inputSchema: {
      type: "object",
      required: ["property_id"],
      properties: {
        property_id: { type: "string", description: "The unique ID of the property" },
      },
    },
    handlerType: "connector",
    handlerConfig: { method: "getListingById" },
  },

  check_availability: {
    name: "check_availability",
    description:
      "Check whether a specific rental property is still available for rent. " +
      "Returns availability status, the earliest move-in date, and verification status.",
    inputSchema: {
      type: "object",
      required: ["property_id"],
      properties: {
        property_id: { type: "string", description: "The unique ID of the property" },
      },
    },
    handlerType: "connector",
    handlerConfig: { method: "checkListingAvailability" },
  },

  compare_properties: {
    name: "compare_properties",
    description:
      "Compare 2 to 4 rental properties side by side on key attributes: " +
      "rent, deposit, size, bedrooms, locality, amenities, furnishing, and verification status. " +
      "Use this when a user wants to evaluate multiple listings before making a decision.",
    inputSchema: {
      type: "object",
      required: ["property_ids"],
      properties: {
        property_ids: {
          type: "array",
          items: { type: "string" },
          description: "List of 2-4 property IDs to compare",
        },
      },
    },
    handlerType: "connector",
    handlerConfig: { method: "compareListings" },
  },

  schedule_visit: {
    name: "schedule_visit",
    description:
      "Schedule a property visit at a rental listing. " +
      "Requires the visitor's name, phone number, preferred date and time slot. " +
      "This is a transactional action — confirm the details with the user before calling this tool.",
    inputSchema: {
      type: "object",
      required: ["property_id", "visitor_name", "visitor_phone", "preferred_date", "preferred_time"],
      properties: {
        property_id: { type: "string", description: "The ID of the property to visit" },
        visitor_name: { type: "string", description: "Full name of the person visiting" },
        visitor_phone: { type: "string", description: "Phone number for visit confirmation" },
        visitor_email: { type: "string", description: "Email address (optional)" },
        preferred_date: { type: "string", description: "Preferred visit date in YYYY-MM-DD format" },
        preferred_time: {
          type: "string",
          enum: ["morning", "afternoon", "evening"],
          description: "Preferred time slot: morning (9am-12pm), afternoon (12pm-4pm), or evening (4pm-7pm)",
        },
        notes: { type: "string", description: "Any special requests or questions for the visit" },
      },
    },
    handlerType: "connector",
    handlerConfig: { method: "scheduleVisit" },
  },

  get_neighborhood_info: {
    name: "get_neighborhood_info",
    description:
      "Get information about a locality or neighborhood. " +
      "Returns nearby amenities like metro stations, hospitals, schools, restaurants, malls, and parks. " +
      "Also includes area characteristics, average rent ranges, and connectivity info. " +
      "Use this to help users evaluate a location before choosing a property.",
    inputSchema: {
      type: "object",
      required: ["locality"],
      properties: {
        locality: { type: "string", description: "The locality/neighborhood/area name" },
      },
    },
    handlerType: "connector",
    handlerConfig: { method: "getNeighborhoodInfo" },
  },
};

/**
 * Given rental capability flags, return the relevant rental tool templates.
 */
export function getTemplatesForRentalCapabilities(capabilities: ConnectorCapabilities): ToolTemplate[] {
  const result: ToolTemplate[] = [];

  if (capabilities.propertySearch) result.push(RENTAL_TOOL_TEMPLATES.search_properties!);
  if (capabilities.propertyDetails) result.push(RENTAL_TOOL_TEMPLATES.get_property_details!);
  if (capabilities.availability) result.push(RENTAL_TOOL_TEMPLATES.check_availability!);
  if (capabilities.propertySearch && capabilities.propertyDetails) {
    result.push(RENTAL_TOOL_TEMPLATES.compare_properties!);
  }
  if (capabilities.visitScheduling) result.push(RENTAL_TOOL_TEMPLATES.schedule_visit!);
  if (capabilities.neighborhoodInfo) result.push(RENTAL_TOOL_TEMPLATES.get_neighborhood_info!);

  return result;
}
