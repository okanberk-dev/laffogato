import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";

import { createSlideAction } from "../actions";
import { SlideForm } from "../slide-form";

export const metadata = { title: "Admin · Yeni vitrin slaytı" };
export const dynamic = "force-dynamic";

export default async function NewSlidePage() {
  await requireRole("shopHero");
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Katalog · Mağaza vitrini"
        title="Yeni slayt"
        description="Mağaza sayfasının en üstündeki kayan alana bir slayt ekle: görsel, başlık, alt yazı ve isteğe bağlı bir düğme."
      />
      <SlideForm action={createSlideAction} submitLabel="Slaytı kaydet" />
    </main>
  );
}
