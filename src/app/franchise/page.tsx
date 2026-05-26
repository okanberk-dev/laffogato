import { pageMetadata, renderSectionPage } from "@/lib/seo/section-page";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata("franchise");

export default function FranchisePage() {
  return renderSectionPage("franchise");
}
