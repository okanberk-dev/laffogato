import { pageMetadata, renderSectionPage } from "@/lib/seo/section-page";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata("visit");

export default function ZiyaretPage() {
  return renderSectionPage("visit");
}
