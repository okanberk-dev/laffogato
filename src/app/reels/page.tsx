import { pageMetadata, renderSectionPage } from "@/lib/seo/section-page";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata("reels");

export default function ReelsPage() {
  return renderSectionPage("reels");
}
