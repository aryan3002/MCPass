import type { VisitRequest } from "@mcpaas/kernel-types";
import { getSupabaseClient } from "./client.js";

export interface CreateVisitInput {
  tenantId: string;
  propertyId: string;
  visitorName: string;
  visitorPhone: string;
  visitorEmail?: string;
  preferredDate: string;
  preferredTime: "morning" | "afternoon" | "evening";
  notes?: string;
  sessionId?: string;
}

export async function createVisitRequest(input: CreateVisitInput): Promise<VisitRequest> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("visit_requests")
    .insert({
      tenant_id: input.tenantId,
      property_id: input.propertyId,
      visitor_name: input.visitorName,
      visitor_phone: input.visitorPhone,
      visitor_email: input.visitorEmail ?? null,
      preferred_date: input.preferredDate,
      preferred_time: input.preferredTime,
      notes: input.notes ?? null,
      session_id: input.sessionId ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create visit request: ${error?.message ?? "Unknown error"}`);
  }

  return {
    id: data.id,
    tenantId: data.tenant_id,
    propertyId: data.property_id,
    visitorName: data.visitor_name,
    visitorPhone: data.visitor_phone,
    visitorEmail: data.visitor_email,
    preferredDate: data.preferred_date,
    preferredTime: data.preferred_time,
    status: data.status,
    notes: data.notes,
    sessionId: data.session_id,
    createdAt: new Date(data.created_at),
  };
}
