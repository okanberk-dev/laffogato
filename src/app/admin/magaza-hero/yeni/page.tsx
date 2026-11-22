import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";

import { createSlideAction } from "../actions";
import { SlideForm } from "../slide-form";

export const metadata = { title: "Admin · Yeni vitrin slaytı" };
export const dynamic = "force-dynamic";

export default async function NewSlidePage() {
  await requireRole("shopHero");
  return (
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 lg:px-6 lg:pt-6 [&>:not(header)]:max-w-4xl">
      <PageHeader
        title="Yeni slayt"
        description="Mağaza sayfasının en üstündeki kayan alana bir slayt ekle: görsel, başlık, alt yazı ve isteğe bağlı bir düğme."
      />
      <SlideForm action={createSlideAction} submitLabel="Slaytı kaydet" />
    </main>
  );
}
