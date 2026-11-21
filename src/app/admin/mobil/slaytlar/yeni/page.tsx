import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";

import { BackLink } from "../../app-content-list";
import { createSlideAction } from "../actions";
import { AppSlideForm } from "../slide-form";

export const metadata = { title: "Admin · Yeni slayt" };
export const dynamic = "force-dynamic";

export default async function NewAppSlidePage() {
  await requireRole("mobileApp");

  return (
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 lg:px-6 lg:pt-6 [&>:not(header)]:max-w-3xl">
      <BackLink href="/admin/mobil/slaytlar" label="Slaytlar" />
      <PageHeader
        title="Yeni slayt"
        description="Ana sayfadaki kayan kartlardan biri."
      />
      <AppSlideForm action={createSlideAction} submitLabel="Slaytı oluştur" />
    </main>
  );
}
