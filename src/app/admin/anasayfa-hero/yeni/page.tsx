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
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="İçerik · Anasayfa slaytları"
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
