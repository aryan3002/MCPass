import type { Metadata } from "next";
import "./globals.css";
import { getCurrentTenant } from "@/lib/supabase";
import Sidebar from "./sidebar";

export const metadata: Metadata = {
  title: "MCPaaS Dashboard",
  description: "Merchant dashboard for MCPaaS - MCP Infrastructure as a Service",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();

  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        <div className="flex min-h-screen">
          {tenant ? (
            <Sidebar tenantName={tenant.name} tenantSlug={tenant.slug} />
          ) : null}
          <main className="flex-1 p-8 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
