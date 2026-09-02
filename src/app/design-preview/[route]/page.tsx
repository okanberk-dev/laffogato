import { LaffogatoApp } from "@/components/laffogato/app";
import type { Route } from "@/components/laffogato/chrome";

export const dynamic = "force-dynamic";

// TEMP design-preview route — renders the SPA with seed data so the redesign
// can be verified without a live MongoDB connection. Delete before shipping.
export default async function DesignPreview({
  params,
}: {
  params: Promise<{ route: string }>;
}) {
  const { route } = await params;
  return (
    <LaffogatoApp initialRoute={route as Route} freeShippingThreshold={500} />
  );
}
