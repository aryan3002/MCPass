import { getCurrentTenant, getCurrentTenantId } from "@/lib/supabase";
import { getToolStats, getTenantTools } from "@/lib/queries";
import { redirect } from "next/navigation";
import ToolsClient from "./tools-client";

export const dynamic = "force-dynamic";

const CRIBLIV_TOOLS = [
  {
    name: "search_properties",
    description: "Search rental listings. Filter by locality, budget, bedrooms, amenities, and more.",
    type: "Discovery",
    params: ["city", "locality", "type", "bedrooms", "budget_min", "budget_max", "amenities", "furnishing"],
  },
  {
    name: "get_property_details",
    description: "Get complete details about a specific rental property including photos and lease terms.",
    type: "Discovery",
    params: ["property_id"],
  },
  {
    name: "check_availability",
    description: "Check whether a specific rental property is still available.",
    type: "Discovery",
    params: ["property_id"],
  },
  {
    name: "compare_properties",
    description: "Compare 2-4 rental properties side by side on key attributes.",
    type: "Discovery",
    params: ["property_ids"],
  },
  {
    name: "schedule_visit",
    description: "Schedule a property visit. Team will confirm and contact the visitor.",
    type: "Transaction",
    params: ["property_id", "visitor_name", "visitor_phone", "preferred_date"],
  },
  {
    name: "get_neighborhood_info",
    description: "Get detailed info about a neighborhood: metro, hospitals, schools, restaurants, parks.",
    type: "Information",
    params: ["locality"],
  },
];

export default async function ToolsPage() {
  const tenant = await getCurrentTenant();
  const tenantId = await getCurrentTenantId();

  if (!tenantId || !tenant) {
    redirect("/onboarding");
  }

  const connectorType = (tenant.config as { connectorType?: string })?.connectorType;
  const isCribliv = !connectorType || connectorType === "cribliv";
  const dbTools = await getTenantTools(tenantId);
  const toolStats = await getToolStats(tenantId);

  const criblivTools = isCribliv
    ? CRIBLIV_TOOLS.map((t) => ({
        id: t.name,
        name: t.name,
        description: t.description,
        isEnabled: true,
        type: t.type,
        params: t.params,
        handlerType: "code" as const,
        handlerConfig: null as Record<string, unknown> | null,
        inputSchema: {} as Record<string, unknown>,
        isCodeDefined: true,
      }))
    : [];

  return (
    <ToolsClient
      tenantName={tenant.name}
      isCribliv={isCribliv}
      criblivTools={criblivTools}
      dbTools={dbTools}
      toolStats={toolStats}
      connectorType={connectorType ?? "manual"}
    />
  );
}
