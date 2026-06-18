import { pageMetadata, renderSectionPage } from "@/lib/seo/section-page";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata("story");

export default function HikayemizPage() {
  return renderSectionPage("story");
}
