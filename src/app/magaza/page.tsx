import { pageMetadata, renderSectionPage } from "@/lib/seo/section-page";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata("shop");

export default function MagazaPage() {
  return renderSectionPage("shop");
}
