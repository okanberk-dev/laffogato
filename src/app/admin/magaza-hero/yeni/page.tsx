import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";

import { createSlideAction } from "../actions";
import { SlideForm } from "../slide-form";

export const metadata = { title: "Yeni slayt · Admin" };
export const dynamic = "force-dynamic";

export default async function NewSlidePage() {
  await requireRole("shopHero");
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Shop · Hero slider"
        title="Yeni slayt"
        description="Mağaza sayfasının üstüne eklenecek slayt — görsel, başlık ve küçük yazı."
      />
      <SlideForm action={createSlideAction} submitLabel="Slaytı kaydet" />
    </main>
  );
}
