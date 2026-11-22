import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { nextHomeHeroSortOrder } from "@/lib/admin/home-hero";
import type { HomeHeroSlideInput } from "@/lib/admin/home-hero-core";

import { createHomeSlideAction } from "../actions";
import { HomeSlideForm } from "../slide-form";

export const metadata = { title: "Admin · Yeni anasayfa slaytı" };
export const dynamic = "force-dynamic";

export default async function NewHomeSlidePage() {
  await requireRole("content");
  const defaults: HomeHeroSlideInput = {
    sortOrder: await nextHomeHeroSortOrder(),
    isActive: true,
    startsAt: "",
    endsAt: "",
    kicker: "",
    titleLine1: "",
    titleLine2: "",
    body: "",
    image: "",
    alt: "",
    scene: "latte",
    primaryLabel: "",
    primaryAction: "",
    primaryHref: "",
    secondaryLabel: "",
    secondaryAction: "",
    secondaryHref: "",
  };
  return (
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 lg:px-6 lg:pt-6">
      <PageHeader
        title="Yeni slayt"
        description="Anasayfanın en üstündeki kayan alana bir kampanya ya da ürün slaytı ekle. Yayın aralığı verirsen o tarihlerde kendiliğinden açılıp kapanır."
      />
      <HomeSlideForm
        action={createHomeSlideAction}
        defaults={defaults}
        submitLabel="Slaytı kaydet"
      />
    </main>
  );
}
