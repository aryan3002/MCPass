import {
  BaseConnector,
  type ConnectorCapabilities,
} from "./types.js";
import {
  searchProperties,
  getPropertyById,
  getPropertiesByIds,
  createVisitRequest,
  searchProducts as dsSearchProducts,
  getProductById as dsGetProductById,
} from "@mcpaas/kernel-datastore";
import type { BusinessDomain } from "@mcpaas/kernel-types";

/**
 * MongoDB Connector — domain-aware connector that delegates to Supabase at tool-call time.
 *
 * MongoDB is only used at sync time (via the dashboard sync route).
 * At tool-call time, this connector queries Supabase (properties or products table)
 * based on the businessDomain.
 */
export class MongoDBConnector extends BaseConnector {
  readonly type = "mongodb";
  capabilities: ConnectorCapabilities = {
    search: false,
    productDetails: false,
    inventory: false,
    cart: false,
    checkout: false,
    recommendations: false,
    propertySearch: false,
    propertyDetails: false,
    availability: false,
    visitScheduling: false,
    neighborhoodInfo: false,
    slotSearch: false,
    bookAppointment: false,
  };

  private tenantId = "";
  private businessDomain: BusinessDomain = "rental";

  async authenticate(credentials: Record<string, string>): Promise<void> {
    this.tenantId = credentials.tenantId ?? "";
    this.businessDomain = (credentials.businessDomain as BusinessDomain) ?? "rental";

    // Set capabilities based on domain
    if (this.businessDomain === "rental") {
      this.capabilities.propertySearch = true;
      this.capabilities.propertyDetails = true;
      this.capabilities.availability = true;
      this.capabilities.visitScheduling = true;
      this.capabilities.neighborhoodInfo = true;
    } else if (this.businessDomain === "ecommerce") {
      this.capabilities.search = true;
      this.capabilities.productDetails = true;
      this.capabilities.inventory = true;
    }
  }

  async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    return { ok: true, message: `MongoDB connector (${this.businessDomain} domain) ready` };
  }

  // ── Rental methods (delegate to properties table via kernel-datastore) ──

  async searchListings(params: Record<string, unknown>): Promise<unknown> {
    const results = await searchProperties(this.tenantId, {
      city: params.city as string | undefined,
      locality: params.locality as string | undefined,
      type: params.type as "apartment" | "pg" | "villa" | "studio" | undefined,
      bedrooms: params.bedrooms as number | undefined,
      budgetMin: params.budget_min as number | undefined,
      budgetMax: params.budget_max as number | undefined,
      amenities: params.amenities as string[] | undefined,
      furnishing: params.furnishing as "Furnished" | "Semi-Furnished" | "Unfurnished" | undefined,
      isVerified: params.verified_only as boolean | undefined,
      limit: (params.limit as number) ?? 5,
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
      total_results: listings.length,
      listings,
      tip: listings.length === 0
        ? "No listings match your criteria. Try broadening your search."
        : `Found ${listings.length} listing(s). Ask for details on any listing by its ID.`,
    };
  }

  async getListingById(params: Record<string, unknown>): Promise<unknown> {
    const id = (params.property_id ?? params.id) as string;
    const property = await getPropertyById(this.tenantId, id);
    if (!property) return { error: "Property not found" };
    return property;
  }

  async checkListingAvailability(params: Record<string, unknown>): Promise<unknown> {
    const id = (params.property_id ?? params.id) as string;
    const property = await getPropertyById(this.tenantId, id);
    if (!property) return { available: false, message: "Property not found" };
    return {
      available: property.isActive,
      available_from: property.availableFrom ?? "Immediately",
      property_id: property.id,
      title: property.title,
    };
  }

  async compareListings(params: Record<string, unknown>): Promise<unknown> {
    const ids = params.property_ids as string[];
    if (!ids || ids.length < 2) return { error: "Provide at least 2 property IDs" };
    const properties = await getPropertiesByIds(this.tenantId, ids);
    return {
      comparison: properties.map((p) => ({
        id: p.id,
        title: p.title,
        type: p.type,
        bedrooms: p.bedrooms,
        rent_monthly: p.rentMonthly,
        deposit: p.deposit,
        area_sqft: p.areaSqft,
        locality: p.locality,
        furnishing: p.furnishing,
        amenities: p.amenities,
        is_verified: p.isVerified,
      })),
    };
  }

  async scheduleVisit(params: Record<string, unknown>): Promise<unknown> {
    const property = await getPropertyById(this.tenantId, params.property_id as string);
    if (!property) return { error: "Property not found" };

    const visit = await createVisitRequest({
      tenantId: this.tenantId,
      propertyId: params.property_id as string,
      visitorName: params.visitor_name as string,
      visitorPhone: params.visitor_phone as string,
      visitorEmail: (params.visitor_email as string) ?? undefined,
      preferredDate: params.preferred_date as string,
      preferredTime: params.preferred_time as "morning" | "afternoon" | "evening",
      notes: (params.notes as string) ?? undefined,
    });

    return {
      visit_id: visit.id,
      status: "confirmed",
      property: { id: property.id, title: property.title, locality: property.locality },
      message: `Visit scheduled for ${params.preferred_date}.`,
    };
  }

  async getNeighborhoodInfo(params: Record<string, unknown>): Promise<unknown> {
    // Return basic info — detailed data is in CribLiv's static handler
    return {
      locality: params.locality,
      message: "Neighborhood information available through the MCP tools.",
    };
  }

  // ── Override execute to route method names explicitly ──

  override async execute(method: string, params: Record<string, unknown>): Promise<unknown> {
    switch (method) {
      // Rental
      case "searchListings": return this.searchListings(params);
      case "getListingById": return this.getListingById(params);
      case "checkListingAvailability": return this.checkListingAvailability(params);
      case "compareListings": return this.compareListings(params);
      case "scheduleVisit": return this.scheduleVisit(params);
      case "getNeighborhoodInfo": return this.getNeighborhoodInfo(params);
      // Ecommerce
      case "searchProducts": return this._searchProducts(params);
      case "getProductById": return this._getProductById(params);
      case "checkInventory": return this._checkInventory(params);
      default:
        throw new Error(`MongoDBConnector does not support method "${method}"`);
    }
  }

  // ── Ecommerce methods (delegate to products table via kernel-datastore) ──

  private async _searchProducts(params: Record<string, unknown>): Promise<unknown> {
    const results = await dsSearchProducts(this.tenantId, {
      query: params.query as string | undefined,
      category: params.category as string | undefined,
      minPrice: params.min_price as number | undefined,
      maxPrice: params.max_price as number | undefined,
      limit: (params.limit as number) ?? 10,
    });

    return {
      total_results: results.length,
      products: results.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        price: p.price,
        currency: p.currency,
        inventory: p.inventory,
        images: p.images,
        categories: p.categories,
      })),
    };
  }

  private async _getProductById(params: Record<string, unknown>): Promise<unknown> {
    const id = (params.product_id ?? params.id) as string;
    const product = await dsGetProductById(this.tenantId, id);
    if (!product) return { error: "Product not found" };
    return product;
  }

  private async _checkInventory(params: Record<string, unknown>): Promise<unknown> {
    const id = (params.product_id ?? params.id) as string;
    const product = await dsGetProductById(this.tenantId, id);
    if (!product) return { available: false, quantity: 0 };
    return {
      available: product.inventory === null || product.inventory > 0,
      quantity: product.inventory,
      product_id: product.id,
      title: product.title,
    };
  }
}
