import { pageMetadata, renderSectionPage } from "@/lib/seo/section-page";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata("menu");

export default function MenuPage() {
  return renderSectionPage("menu");
}
