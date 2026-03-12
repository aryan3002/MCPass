import { z } from "zod";
import type { ToolCallResponse } from "@mcpaas/kernel-types";

export const getNeighborhoodInfoSchema = z.object({
  locality: z.string().describe("The locality/neighborhood/area name, e.g. 'Knowledge Park 2', 'LDA Colony', 'Sector 168'"),
});

export const getNeighborhoodInfoDescription =
  "Get information about a locality or neighborhood across India. " +
  "Returns nearby amenities like metro stations, hospitals, schools, restaurants, malls, and parks. " +
  "Also includes area characteristics, average rent ranges, and connectivity info. " +
  "Use this to help users evaluate a location before choosing a property.";

// Static neighborhood data for Bangalore localities - sufficient for POC
// Phase 1: Replace with PostGIS queries and Google Places API
const NEIGHBORHOOD_DATA: Record<string, object> = {
  koramangala: {
    locality: "Koramangala",
    description: "One of Bangalore's most vibrant neighborhoods, popular with young professionals and startups. Known for its cafes, restaurants, and nightlife.",
    characteristics: ["Startup hub", "Vibrant nightlife", "Premium residential", "Well-connected"],
    nearby: {
      metro: ["HSR Layout Metro (1.5 km)", "Silk Institute Metro (3 km)"],
      hospitals: ["St. John's Hospital (2 km)", "Manipal Hospital (4 km)"],
      schools: ["NPS Koramangala (1 km)", "Bethany High School (2 km)"],
      restaurants: ["Third Wave Coffee", "Truffles", "Toit Brewpub", "Meghana Foods"],
      malls: ["Forum Mall (1 km)", "Mantri Square (5 km)"],
      parks: ["Koramangala 5th Block Park", "National Games Village Park"],
      it_parks: ["Sony World Junction area", "Koramangala BDA Complex"],
    },
    connectivity: "Well-connected via Hosur Road and Inner Ring Road. Close to HSR Layout and BTM Layout.",
    avg_rent_2bhk: "₹20,000–₹35,000/month",
    vibe: "Young, urban, food-loving",
  },
  indiranagar: {
    locality: "Indiranagar",
    description: "Upscale residential area known for its tree-lined streets, boutique shopping on 100 Feet Road, and premium dining.",
    characteristics: ["Upscale residential", "Great dining", "Boutique shopping", "Tree-lined streets"],
    nearby: {
      metro: ["Indiranagar Metro Station (0.5 km)", "Halasuru Metro (1.5 km)"],
      hospitals: ["Manipal Hospital (3 km)", "Columbia Asia (4 km)"],
      schools: ["Frank Anthony Public School (1 km)", "St. Francis Xavier's (2 km)"],
      restaurants: ["Toit", "The Permit Room", "Windmills Craftworks", "Brahmin's Coffee Bar"],
      malls: ["1MG Road Mall (3 km)", "Phoenix Marketcity (6 km)"],
      parks: ["Indiranagar Municipal Park", "Domlur Park"],
      it_parks: ["Close to MG Road IT corridor"],
    },
    connectivity: "Excellent — Purple Line metro access. Direct buses to Whitefield and Electronic City.",
    avg_rent_2bhk: "₹22,000–₹40,000/month",
    vibe: "Premium, cosmopolitan, expat-friendly",
  },
  "hsr layout": {
    locality: "HSR Layout",
    description: "Planned residential layout popular with IT professionals. Good mix of affordability and modern amenities.",
    characteristics: ["IT professional hub", "Planned layout", "Good value", "Growing nightlife"],
    nearby: {
      metro: ["HSR Layout Metro (1 km)", "Bommanahalli Metro (2 km)"],
      hospitals: ["Fortis Hospital (3 km)", "Narayana Health (5 km)"],
      schools: ["DPS South (2 km)", "Greenwood High (4 km)"],
      restaurants: ["Onesta", "Dintos", "Ramanashree California Resort"],
      malls: ["HSR BDA Complex", "Agara Lake Area"],
      parks: ["Agara Lake (1 km)", "HSR Layout Sector 2 Park"],
      it_parks: ["Close to Sarjapur Road IT corridor", "Near Bellandur IT hub"],
    },
    connectivity: "Good connectivity to Electronic City and Koramangala. Outer Ring Road access.",
    avg_rent_2bhk: "₹16,000–₹28,000/month",
    vibe: "Young professionals, growing food scene",
  },
  whitefield: {
    locality: "Whitefield",
    description: "Major IT hub with ITPL and numerous tech parks. Rapidly developing residential area with modern apartments.",
    characteristics: ["IT hub", "Modern apartments", "Gated communities", "Rapidly developing"],
    nearby: {
      metro: ["Whitefield Metro (1 km) - Purple Line extension"],
      hospitals: ["Columbia Asia Whitefield (2 km)", "Manipal Hospital Whitefield (3 km)"],
      schools: ["Whitefield Global School (1 km)", "Deens Academy (3 km)"],
      restaurants: ["The Whitefield Arms", "Windmills Craftworks", "Barbeque Nation"],
      malls: ["Phoenix Marketcity (3 km)", "Forum Shantiniketan (5 km)"],
      parks: ["ITPL Park", "Whitefield Central Park"],
      it_parks: ["ITPL (0.5 km)", "Prestige Tech Park (2 km)", "Brigade Tech Gardens (3 km)"],
    },
    connectivity: "Purple Line metro extension now operational. Old Airport Road and Varthur Road access.",
    avg_rent_2bhk: "₹15,000–₹25,000/month",
    vibe: "Tech-focused, family-friendly, suburban",
  },
  "electronic city": {
    locality: "Electronic City",
    description: "Bangalore's largest IT park cluster. Home to Infosys, Wipro, TCS, and hundreds of tech companies.",
    characteristics: ["IT corridor", "Affordable", "Corporate township", "Growing infrastructure"],
    nearby: {
      metro: ["Electronic City Metro (Planned Phase 3)"],
      hospitals: ["Narayana Health (2 km)", "Sakra Hospital (5 km)"],
      schools: ["The International School (3 km)", "BGS National Public School (2 km)"],
      restaurants: ["Multiple options in Electronic City Phase 1"],
      malls: ["Gopalan Mall (4 km)", "Elements Mall (8 km)"],
      parks: ["Electronic City Lake Park", "Infosys Campus Gardens"],
      it_parks: ["Infosys Campus (0 km)", "Wipro Campus (1 km)", "TCS (2 km)"],
    },
    connectivity: "NICE Road access. Elevated expressway to Silk Board. Farther from city center.",
    avg_rent_2bhk: "₹12,000–₹20,000/month",
    vibe: "Corporate, affordable, growing",
  },
  marathahalli: {
    locality: "Marathahalli",
    description: "Busy commercial and residential area on the Outer Ring Road. Popular with IT workers due to proximity to tech parks.",
    characteristics: ["Commercial hub", "IT proximity", "Busy", "Good connectivity"],
    nearby: {
      metro: ["Marathahalli Metro (Planned)"],
      hospitals: ["Aster CMI (4 km)", "Sakra Hospital (3 km)"],
      schools: ["Gear Innovative School (2 km)", "DPS East (3 km)"],
      restaurants: ["Empire Restaurant", "Adiga's", "Nandhana Palace"],
      malls: ["Innovative Multiplex", "Phoenix Marketcity (4 km)"],
      parks: ["Marathahalli Lake", "Kaikondrahalli Lake (3 km)"],
      it_parks: ["Outer Ring Road tech corridor", "Prestige Tech Park (5 km)"],
    },
    connectivity: "On Outer Ring Road — direct access to Whitefield, Bellandur, Sarjapur Road.",
    avg_rent_2bhk: "₹14,000–₹22,000/month",
    vibe: "Busy, well-connected, practical",
  },
  "btm layout": {
    locality: "BTM Layout",
    description: "Affordable residential area adjacent to Koramangala. Popular with students and young professionals.",
    characteristics: ["Affordable", "Student-friendly", "Close to Koramangala", "Budget dining"],
    nearby: {
      metro: ["Silk Institute Metro (2 km)"],
      hospitals: ["Apollo Clinic BTM (0.5 km)", "St. John's Hospital (3 km)"],
      schools: ["Multiple options nearby"],
      restaurants: ["Vidyarthi Bhavan", "Meghana Foods", "Various budget eateries"],
      malls: ["Forum Mall (3 km)"],
      parks: ["BTM Lake (1 km)", "Madiwala Lake (2 km)"],
      it_parks: ["Close to Silk Board IT area"],
    },
    connectivity: "Close to Silk Board junction. Good bus connectivity.",
    avg_rent_2bhk: "₹14,000–₹22,000/month",
    vibe: "Budget-friendly, lively, young",
  },
  "jp nagar": {
    locality: "JP Nagar",
    description: "Well-established residential area in South Bangalore. Known for parks, temples, and family-friendly environment.",
    characteristics: ["Family-friendly", "Established", "Green spaces", "Temples"],
    nearby: {
      metro: ["JP Nagar Metro (0.5 km) - Green Line"],
      hospitals: ["Fortis Hospital (2 km)", "Apollo Hospital (4 km)"],
      schools: ["Jain International School (2 km)", "BGS National (3 km)"],
      restaurants: ["Various South Indian restaurants", "Corner House", "Brahmin's Thatte Idli"],
      malls: ["Gopalan Innovation Mall (2 km)"],
      parks: ["JP Nagar 6th Phase Park", "Bannerghatta National Park (nearby)"],
      it_parks: ["Reasonably close to Electronic City"],
    },
    connectivity: "Green Line metro. Well-connected via Bannerghatta Road.",
    avg_rent_2bhk: "₹14,000–₹24,000/month",
    vibe: "Family-oriented, peaceful, green",
  },
};

export function createGetNeighborhoodInfoHandler(_tenantId: string) {
  return async (input: Record<string, unknown>): Promise<ToolCallResponse> => {
    const parsed = getNeighborhoodInfoSchema.parse(input);
    const key = parsed.locality.toLowerCase().trim();

    const data = NEIGHBORHOOD_DATA[key];
    if (!data) {
      return {
        success: true,
        data: {
          locality: parsed.locality,
          description: `${parsed.locality} is a residential area with growing infrastructure. Detailed neighborhood data is being added soon.`,
          available_data_for: Object.keys(NEIGHBORHOOD_DATA).map(
            (k) => k.charAt(0).toUpperCase() + k.slice(1)
          ),
          tip: "Detailed data is currently available for select Bangalore localities. More cities coming soon.",
        },
        metadata: { latencyMs: 0, resultCount: 0 },
      };
    }

    return {
      success: true,
      data,
      metadata: { latencyMs: 0, resultCount: 1 },
    };
  };
}
